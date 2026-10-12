import { AuditActorType, MissionStatus, OrderSide, OrderStatus, Prisma, type PrismaClient } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'
import { calculateEquity, calculateReturnPercent, decimal } from './trading-calculations.js'
import { assertQuoteUsable, quoteMetadata, TradingService } from './trading-service.js'
import type { ExecutionQuote, MarketDataService } from './price-service.js'
import { BLACKOUT_DURATION_MS, nextAutomatedMissionStatus } from './mission-state-service.js'

import { env } from '../config/env.js'
import { cancelCashMission, fundedPool, rewardInclude, reviewDates } from './mission-rewards-service.js'
import { getTreasuryBalance } from './solana-receipt-service.js'
import { SETTLEMENT_WINDOW_MS } from './reward-calculations.js'

export class MissionLifecycleService {
  constructor(private readonly database: PrismaClient, private readonly prices: MarketDataService) {}

  async runOnce(now = new Date()) {
    const missions = await this.database.mission.findMany({
      where: { status: { in: [MissionStatus.REGISTRATION, MissionStatus.LOCKED, MissionStatus.ACTIVE, MissionStatus.BLACKOUT, MissionStatus.SETTLING] } },
      include: { rewardPlan: { include: rewardInclude }, markets: { where: { enabled: true } } },
      orderBy: { startsAt: 'asc' },
    })

    for (const mission of missions) {
      if (mission.rewardPlan) {
        const plan = mission.rewardPlan
        if (now >= plan.fundingDeadline && plan.state === 'FUNDING') { await cancelCashMission(this.database, mission.id, 'Funding or organizer review did not complete by the published deadline.'); continue }
        if (plan.state === 'READY' && now >= plan.registrationClosesAt) {
          const entrants = await this.database.cashParticipant.count({ where: { missionId: mission.id, status: 'APPROVED' } })
          if (entrants < plan.minimumEntrants || env.MARKET_DATA_PROVIDER !== 'jupiter') { await cancelCashMission(this.database, mission.id, 'Minimum verified entrants or live pricing requirements were not met.'); continue }
          let reserveBalance: Prisma.Decimal
          try {
            for (const market of mission.markets) { const buy = await this.prices.getBuyQuote(market, new Prisma.Decimal(100)); await this.prices.getSellQuote(market, buy.quantity) }
            reserveBalance = await getTreasuryBalance(plan.treasuryWallet)
            if (reserveBalance.lessThan(fundedPool(plan))) { await cancelCashMission(this.database, mission.id, 'The treasury does not cover the recorded prize reserve.'); continue }
          } catch { if (now >= mission.startsAt) await cancelCashMission(this.database, mission.id, 'Prize reserve could not be verified before the scheduled start.'); continue }
          await this.database.$transaction(async tx => {
            const fresh = await tx.missionRewardPlan.findUniqueOrThrow({ where: { missionId: mission.id }, include: rewardInclude })
            if (fresh.state !== 'READY') return
            if (reserveBalance.lessThan(fundedPool(fresh)) || await tx.cashParticipant.count({ where: { missionId: mission.id, status: 'APPROVED' } }) < fresh.minimumEntrants) throw new Error('Prize reserve or verified entrants changed while locking.')
            await tx.missionRewardPlan.update({ where: { id: fresh.id }, data: { state: 'LOCKED', lockedAt: now, lockedPool: fundedPool(fresh) } })
            await tx.mission.update({ where: { id: mission.id }, data: { status: 'LOCKED' } })
            await tx.adminAuditLog.create({ data: { actorType: 'SYSTEM', action: 'PRIZE_RESERVE_LOCKED', entityType: 'MissionRewardPlan', entityId: fresh.id, missionId: mission.id, metadata: { reserve: fundedPool(fresh).toString() } } })
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
          continue
        }
        if (plan.state !== 'LOCKED') continue
        if (now.getTime() > mission.endsAt.getTime() + SETTLEMENT_WINDOW_MS) { await cancelCashMission(this.database, mission.id, 'Settlement missed the published 60-second window. Sponsor returns are pending.'); continue }
      }
      const nextStatus = nextAutomatedMissionStatus(mission, now)
      if (nextStatus && nextStatus !== mission.status) await this.transition(mission.id, mission.status, nextStatus, now)
      if (nextStatus === MissionStatus.SETTLING || mission.status === MissionStatus.SETTLING) await this.settle(mission.id, now)
    }
    await new TradingService(this.database, this.prices).processPositionExits(now)
  }

  private async transition(missionId: string, from: MissionStatus, to: MissionStatus, now: Date) {
    await this.database.$transaction(async (transaction) => {
      const updated = await transaction.mission.updateMany({ where: { id: missionId, status: from }, data: { status: to, lifecycleError: null } })
      if (updated.count === 0) return
      await transaction.adminAuditLog.create({ data: {
        actorType: AuditActorType.SYSTEM,
        action: 'MISSION_STATUS_TRANSITIONED',
        entityType: 'Mission',
        entityId: missionId,
        missionId,
        metadata: { from, to, occurredAt: now.toISOString() },
      } })
    })
  }

  private async settle(missionId: string, now: Date) {
    const mission = await this.database.mission.findUnique({
      where: { id: missionId },
      include: {
        rewardPlan: true,
        markets: true,
        entries: { include: { positions: true, user: { include: { wallets: { take: 1, orderBy: { createdAt: 'asc' } } } } } },
      },
    })
    if (!mission || mission.status !== MissionStatus.SETTLING) return

    try {
      const marketById = new Map(mission.markets.map((market) => [market.id, market]))
      const quoteByPosition = new Map<string, ExecutionQuote>()
      // Equal-size positions in the same market share a quote. Different sizes
      // must be priced separately because liquidation depth changes the proceeds.
      const pendingQuotes = new Map<string, Promise<ExecutionQuote>>()
      await Promise.all(mission.entries.flatMap((entry) => entry.positions.filter((position) => position.quantity.greaterThan(0)).map(async (position) => {
        const market = marketById.get(position.missionMarketId)
        if (!market) throw new Error(`Missing settlement market ${position.missionMarketId}.`)
        const key = `${market.id}:${position.quantity.toString()}`
        let pending = pendingQuotes.get(key)
        if (!pending) {
          pending = this.prices.getSellQuote(market, position.quantity)
          pendingQuotes.set(key, pending)
        }
        const quote = await pending
        if (!quote.quantity.equals(position.quantity)) throw new Error(`Settlement quote does not cover the full ${market.symbol} position.`)
        quoteByPosition.set(position.id, quote)
      })))
      if (mission.rewardPlan && (Date.now() > mission.endsAt.getTime() + SETTLEMENT_WINDOW_MS || [...quoteByPosition.values()].some(q => q.quotedAt < mission.endsAt || q.quotedAt.getTime() > mission.endsAt.getTime() + SETTLEMENT_WINDOW_MS))) throw new Error('Settlement quotes fall outside the 60-second window.')
      const results = buildSettlementResults(mission.entries, new Map([...quoteByPosition].map(([id, quote]) => [id, quote.notional])))

      await this.database.$transaction(async (transaction) => {
        const current = await transaction.mission.findUnique({ where: { id: missionId }, select: { status: true } })
        if (!current || current.status !== MissionStatus.SETTLING) return
        if (mission.rewardPlan && Date.now() > mission.endsAt.getTime() + SETTLEMENT_WINDOW_MS) throw new Error('Settlement exceeded the 60-second window.')
        // Validate the entire batch before writing anything; never substitute
        // spot marking when a liquidation route is unavailable or expired.
        for (const entry of mission.entries) {
          for (const position of entry.positions.filter((position) => position.quantity.greaterThan(0))) {
            assertQuoteUsable(quoteByPosition.get(position.id)!, marketById.get(position.missionMarketId)!, OrderSide.SELL)
          }
        }
        await transaction.missionResult.deleteMany({ where: { missionId } })
        for (const entry of mission.entries) {
          let cashBalance = entry.cashBalance
          let realizedPnl = entry.realizedPnl
          for (const position of entry.positions.filter((position) => position.quantity.greaterThan(0))) {
            const quote = quoteByPosition.get(position.id)!
            // notional is the quoted USDC output; fees already represented in
            // that output are metadata, not a second deduction.
            const pnl = quote.notional.minus(position.quantity.mul(position.averageEntryPrice))
            cashBalance = cashBalance.plus(quote.notional)
            realizedPnl = realizedPnl.plus(pnl)
            const order = await transaction.order.create({ data: {
              missionEntryId: entry.id, missionMarketId: position.missionMarketId,
              side: OrderSide.SELL, status: OrderStatus.FILLED, exitReason: 'MISSION_END',
              requestedNotional: quote.notional, requestedQuantity: position.quantity, executedAt: now,
            } })
            await transaction.fill.create({ data: {
              orderId: order.id, executionPrice: quote.executionPrice, quantity: quote.quantity,
              notional: quote.notional, simulatedFee: quote.simulatedFee, ...quoteMetadata(quote),
            } })
            await transaction.position.update({ where: { id: position.id }, data: {
              quantity: 0, averageEntryPrice: 0, realizedPnl: position.realizedPnl.plus(pnl),
              takeProfitPrice: null, stopLossPrice: null, protectionVersion: { increment: 1 },
            } })
          }
          await transaction.missionEntry.update({ where: { id: entry.id }, data: { cashBalance, realizedPnl } })
        }
        for (const market of mission.markets) {
          await transaction.missionMarket.update({ where: { id: market.id }, data: { settledAt: now } })
        }
        if (results.length > 0) {
          await transaction.missionResult.createMany({ data: results.map((result) => ({ ...result, missionId, settledAt: now })) })
        }
        if (mission.rewardPlan) await transaction.missionRewardPlan.update({ where: { missionId }, data: reviewDates(now) })
        await transaction.mission.update({ where: { id: missionId }, data: { status: MissionStatus.FINALIZED, settledAt: now, lifecycleError: null } })
        await transaction.adminAuditLog.create({ data: {
          actorType: AuditActorType.SYSTEM,
          action: 'MISSION_FINALIZED',
          entityType: 'Mission',
          entityId: missionId,
          missionId,
          metadata: { operatorCount: results.length, settledAt: now.toISOString(), valuation: 'SELL_QUOTES', liquidatedPositions: quoteByPosition.size },
        } })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : 'Mission settlement failed.'
      await this.database.$transaction(async (transaction) => {
        const current = await transaction.mission.findUnique({ where: { id: missionId }, select: { status: true, lifecycleError: true } })
        if (!current || current.status !== MissionStatus.SETTLING) return
        await transaction.mission.update({ where: { id: missionId }, data: { lifecycleError: message } })
        if (current.lifecycleError !== message) {
          await transaction.adminAuditLog.create({ data: {
            actorType: AuditActorType.SYSTEM,
            action: 'MISSION_SETTLEMENT_FAILED',
            entityType: 'Mission',
            entityId: missionId,
            missionId,
            metadata: { message, retrying: true },
          } })
        }
      })
    }
  }
}

interface SettlementEntry {
  userId: string
  startingBalance: Decimal
  cashBalance: Decimal
  joinedAt: Date
  positions: Array<{ id: string; missionMarketId: string; quantity: Decimal }>
  user: { username: string | null; wallets: Array<{ address: string }> }
}

export function buildSettlementResults(entries: SettlementEntry[], proceedsByPosition: ReadonlyMap<string, Decimal>) {
  return entries.map((entry) => {
    const marketValues = entry.positions.filter((position) => position.quantity.greaterThan(0)).map((position) => {
      const proceeds = proceedsByPosition.get(position.id)
      if (!proceeds || !proceeds.isFinite() || !proceeds.greaterThan(0)) throw new Error(`Missing or invalid settlement proceeds for position ${position.id}.`)
      return proceeds
    })
    const equity = calculateEquity(entry.cashBalance, marketValues)
    const walletAddress = entry.user.wallets[0]?.address ?? null
    return {
      userId: entry.userId,
      displayName: entry.user.username ?? (walletAddress ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}` : `Operator ${entry.userId.slice(-6)}`),
      walletAddress,
      equity,
      pnl: equity.minus(entry.startingBalance),
      returnPercent: calculateReturnPercent(equity, entry.startingBalance),
      joinedAt: entry.joinedAt,
    }
  }).sort((left, right) => {
    const equityComparison = decimal(right.equity).comparedTo(left.equity)
    return equityComparison === 0 ? left.joinedAt.getTime() - right.joinedAt.getTime() : equityComparison
  }).map((result, index) => ({ userId: result.userId, displayName: result.displayName, walletAddress: result.walletAddress, equity: result.equity, pnl: result.pnl, returnPercent: result.returnPercent, rank: index + 1 }))
}

export function startMissionLifecycleScheduler(service: MissionLifecycleService, intervalMs: number, onError: (error: unknown) => void) {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try { await service.runOnce() } catch (error: unknown) { onError(error) } finally { running = false }
  }
  void tick()
  const timer = setInterval(() => void tick(), intervalMs)
  timer.unref()
  return () => clearInterval(timer)
}

export const blackoutDurationMs = BLACKOUT_DURATION_MS
