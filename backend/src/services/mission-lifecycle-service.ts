import { AuditActorType, MissionStatus, Prisma, type PrismaClient } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'
import { calculateEquity, calculateMarketValue, calculateReturnPercent, decimal } from './trading-calculations.js'
import { TradingService } from './trading-service.js'
import type { MarketDataService } from './price-service.js'
import { BLACKOUT_DURATION_MS, nextAutomatedMissionStatus } from './mission-state-service.js'

export class MissionLifecycleService {
  constructor(private readonly database: PrismaClient, private readonly prices: MarketDataService) {}

  async runOnce(now = new Date()) {
    const missions = await this.database.mission.findMany({
      where: { status: { in: [MissionStatus.REGISTRATION, MissionStatus.LOCKED, MissionStatus.ACTIVE, MissionStatus.BLACKOUT, MissionStatus.SETTLING] } },
      orderBy: { startsAt: 'asc' },
    })

    for (const mission of missions) {
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
        markets: true,
        entries: { include: { positions: true, user: { include: { wallets: { take: 1, orderBy: { createdAt: 'asc' } } } } } },
      },
    })
    if (!mission || mission.status !== MissionStatus.SETTLING) return

    try {
      const quotes = await this.prices.getPrices(mission.markets)
      const priceByMarket = new Map(quotes.map((quote) => [quote.marketId, quote.price]))
      const missingMarket = mission.markets.find((market) => !priceByMarket.has(market.id))
      if (missingMarket) throw new Error(`No settlement price is available for ${missingMarket.symbol}.`)
      const results = buildSettlementResults(mission.entries, priceByMarket)

      await this.database.$transaction(async (transaction) => {
        const current = await transaction.mission.findUnique({ where: { id: missionId }, select: { status: true } })
        if (!current || current.status !== MissionStatus.SETTLING) return
        await transaction.missionResult.deleteMany({ where: { missionId } })
        for (const market of mission.markets) {
          const settlementPrice = priceByMarket.get(market.id)
          if (!settlementPrice) throw new Error(`No settlement price is available for ${market.symbol}.`)
          await transaction.missionMarket.update({ where: { id: market.id }, data: { settlementPrice, settledAt: now } })
        }
        if (results.length > 0) {
          await transaction.missionResult.createMany({ data: results.map((result) => ({ ...result, missionId, settledAt: now })) })
        }
        await transaction.mission.update({ where: { id: missionId }, data: { status: MissionStatus.FINALIZED, settledAt: now, lifecycleError: null } })
        await transaction.adminAuditLog.create({ data: {
          actorType: AuditActorType.SYSTEM,
          action: 'MISSION_FINALIZED',
          entityType: 'Mission',
          entityId: missionId,
          missionId,
          metadata: { operatorCount: results.length, settledAt: now.toISOString() },
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
  positions: Array<{ missionMarketId: string; quantity: Decimal }>
  user: { username: string | null; wallets: Array<{ address: string }> }
}

export function buildSettlementResults(entries: SettlementEntry[], priceByMarket: ReadonlyMap<string, Decimal>) {
  return entries.map((entry) => {
    const marketValues = entry.positions.filter((position) => position.quantity.isPositive()).map((position) => {
      const price = priceByMarket.get(position.missionMarketId)
      if (!price) throw new Error(`Missing settlement price for market ${position.missionMarketId}.`)
      return calculateMarketValue(position.quantity, price)
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
