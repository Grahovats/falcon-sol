import { MissionStatus, OrderSide, OrderStatus, Prisma, type PrismaClient } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSettlementResults, MissionLifecycleService } from './mission-lifecycle-service.js'
import type { ExecutionQuote, MarketDataService } from './price-service.js'

const amount = (value: string | number) => new Prisma.Decimal(value)
const now = new Date('2026-10-11T12:00:00Z')
const entry = (userId: string, quantity = '5', cash = '500', joinedAt = now) => ({
  id: `entry-${userId}`, userId, startingBalance: amount('1000'), cashBalance: amount(cash), realizedPnl: amount(0), joinedAt,
  positions: [{ id: `position-${userId}`, missionMarketId: 'SOL', quantity: amount(quantity), averageEntryPrice: amount(100), realizedPnl: amount(0) }],
  user: { username: userId, wallets: [] },
})

function fixture(entries = [entry('user')]) {
  const market = { id: 'SOL', symbol: 'SOL', mintAddress: 'sol-mint', decimals: 9 }
  const mission = { id: 'mission', status: MissionStatus.SETTLING as MissionStatus, startsAt: new Date(0), endsAt: new Date(1), lifecycleError: null as string | null, entries, markets: [market] }
  const quote = (quantity: Prisma.Decimal): ExecutionQuote => ({
    provider: 'jupiter', requestId: `quote-${quantity}`, quoteId: null, router: 'metis',
    inputMint: market.mintAddress, outputMint: 'USDC', inputAmount: quantity.mul(1e9).toFixed(0), outputAmount: quantity.mul(90e6).toFixed(0),
    quantity, notional: quantity.mul(90), executionPrice: amount(90), referencePrice: amount(100),
    priceImpactPercent: amount(10), simulatedFee: amount(1), routePlan: [{ swapInfo: { label: 'test-route' } }], quotedAt: now, expiresAt: null,
  })
  const database = {
    mission: {
      findMany: vi.fn().mockImplementation(async () => mission.status === MissionStatus.SETTLING ? [mission] : []),
      findUnique: vi.fn().mockImplementation(async () => mission),
      update: vi.fn().mockImplementation(async ({ data }: { data: Partial<typeof mission> }) => Object.assign(mission, data)),
    },
    missionMarket: { update: vi.fn() },
    missionResult: { deleteMany: vi.fn(), createMany: vi.fn() },
    missionEntry: { update: vi.fn() },
    position: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    order: { create: vi.fn().mockResolvedValue({ id: 'order' }) },
    fill: { create: vi.fn() },
    adminAuditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  database.$transaction.mockImplementation(async (operation: (tx: typeof database) => Promise<unknown>) => operation(database))
  const prices = {
    getPrices: vi.fn(),
    getSellQuote: vi.fn().mockImplementation(async (_market: unknown, quantity: Prisma.Decimal) => quote(quantity)),
  }
  const service = new MissionLifecycleService(database as unknown as PrismaClient, prices as unknown as MarketDataService)
  return { database, prices, service, mission, market, quote }
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => { vi.useRealTimers() })

describe('mission settlement scoring', () => {
  it('ranks by quoted proceeds for each position size, rather than a shared spot price', () => {
    // At a $100 spot price the large position appears worth $1,000 and wins.
    // Its full-size sell returns only $700, so the smaller portfolio wins.
    const results = buildSettlementResults([entry('large', '10', '0'), entry('small', '5', '500')],
      new Map([['position-large', amount(700)], ['position-small', amount(450)]]))
    expect(results.map(result => [result.userId, result.rank, result.equity.toString(), result.pnl.toString(), result.returnPercent.toString()])).toEqual([
      ['small', 1, '950', '-50', '-5'], ['large', 2, '700', '-300', '-30'],
    ])
  })

  it('preserves deterministic join-time tie breaking', () => {
    const results = buildSettlementResults([
      entry('later', '5', '500', new Date(now.getTime() + 1000)), entry('first'), entry('winner', '5', '700'),
    ], new Map(['later', 'first', 'winner'].map(id => [`position-${id}`, amount(450)])))
    expect(results.map(result => [result.userId, result.rank])).toEqual([['winner', 1], ['first', 2], ['later', 3]])
  })

  it('does not require a quote for zero positions or a cash-only portfolio', () => {
    const results = buildSettlementResults([entry('cash', '0', '1000')], new Map())
    expect(results[0]?.equity.toString()).toBe('1000')
  })

  it.each(['missing', '0', '-1', 'NaN', 'Infinity'])('fails closed for %s liquidation proceeds', value => {
    const proceeds = value === 'missing' ? new Map<string, Prisma.Decimal>() : new Map([['position-user', amount(value)]])
    expect(() => buildSettlementResults([entry('user')], proceeds)).toThrow('settlement proceeds')
  })
})

describe('mission liquidation', () => {
  it('records quote-backed final sells and credits net proceeds once, keeping the portfolio consistent with the result', async () => {
    const { service, database, prices, market } = fixture()
    await service.runOnce(now)
    expect(prices.getSellQuote).toHaveBeenCalledWith(market, amount(5))
    expect(prices.getPrices).not.toHaveBeenCalled()
    expect(database.order.create).toHaveBeenCalledWith({ data: expect.objectContaining({ side: OrderSide.SELL, status: OrderStatus.FILLED, exitReason: 'MISSION_END', requestedQuantity: amount(5), executedAt: now }) })
    expect(database.fill.create).toHaveBeenCalledWith({ data: expect.objectContaining({ quantity: amount(5), notional: amount(450), simulatedFee: amount(1), quoteProvider: 'jupiter', quoteRequestId: 'quote-5', routePlan: [{ swapInfo: { label: 'test-route' } }], quotedAt: now }) })
    const balances = database.missionEntry.update.mock.calls[0]?.[0].data
    expect(balances.cashBalance.toString()).toBe('950')
    expect(balances.realizedPnl.toString()).toBe('-50')
    expect(database.position.update).toHaveBeenCalledWith({ where: { id: 'position-user' }, data: expect.objectContaining({ quantity: 0, averageEntryPrice: 0, realizedPnl: amount(-50), takeProfitPrice: null, stopLossPrice: null, protectionVersion: { increment: 1 } }) })
    const result = database.missionResult.createMany.mock.calls[0]?.[0].data[0]
    expect(result.equity.toString()).toBe(balances.cashBalance.toString())
    expect(result.returnPercent.toString()).toBe('-5')
    expect(database.mission.update).toHaveBeenCalledWith({ where: { id: 'mission' }, data: { status: MissionStatus.FINALIZED, settledAt: now, lifecycleError: null } })
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    await service.runOnce(now)
    expect(database.order.create).toHaveBeenCalledTimes(1)
    expect(database.fill.create).toHaveBeenCalledTimes(1)
  })

  it('quotes equal-sized holdings once, and different sizes separately', async () => {
    const { service, prices } = fixture([entry('a'), entry('b'), entry('c', '10')])
    await service.runOnce(now)
    expect(prices.getSellQuote).toHaveBeenCalledTimes(2)
  })

  it('finalizes cash-only entrants without depending on market prices or routes', async () => {
    const { service, prices, database } = fixture([entry('cash', '0', '1000')])
    await service.runOnce(now)
    expect(prices.getSellQuote).not.toHaveBeenCalled()
    expect(database.order.create).not.toHaveBeenCalled()
    expect(database.missionResult.createMany.mock.calls[0]?.[0].data[0].equity.toString()).toBe('1000')
  })

  it('leaves settlement pending with no liquidation writes when any quote fails, then retries successfully', async () => {
    const { service, prices, database, mission } = fixture([entry('a'), entry('b', '10')])
    prices.getSellQuote.mockRejectedValueOnce(new Error('No sell route'))
    await service.runOnce(now)
    expect(mission.status).toBe(MissionStatus.SETTLING)
    expect(mission.lifecycleError).toBe('No sell route')
    expect(database.order.create).not.toHaveBeenCalled()
    expect(database.position.update).not.toHaveBeenCalled()
    expect(database.missionResult.createMany).not.toHaveBeenCalled()
    await service.runOnce(now)
    expect(mission.status).toBe(MissionStatus.FINALIZED)
    expect(mission.lifecycleError).toBeNull()
    expect(database.order.create).toHaveBeenCalledTimes(2)
  })

  it.each(['stale', 'expired', 'wrong mint', 'partial quantity', 'invalid proceeds'])('refuses %s quotes before writing any liquidation', async kind => {
    const { service, prices, database, mission, quote } = fixture([entry('a'), entry('b', '10')])
    prices.getSellQuote.mockImplementation(async (_market, quantity) => ({
      ...quote(quantity),
      ...(kind === 'stale' ? { quotedAt: new Date(now.getTime() - 11_000) } : {}),
      ...(kind === 'expired' ? { expiresAt: now } : {}),
      ...(kind === 'wrong mint' ? { inputMint: 'wrong' } : {}),
      ...(kind === 'partial quantity' ? { quantity: quantity.minus(1) } : {}),
      ...(kind === 'invalid proceeds' ? { notional: amount(0) } : {}),
    }))
    await service.runOnce(now)
    expect(mission.status).toBe(MissionStatus.SETTLING)
    expect(mission.lifecycleError).toBeTruthy()
    expect(database.order.create).not.toHaveBeenCalled()
    expect(database.missionEntry.update).not.toHaveBeenCalled()
    expect(database.missionResult.deleteMany).not.toHaveBeenCalled()
  })

  it('does not write results if another worker has finalized while quotes were being fetched', async () => {
    const { service, prices, database, mission, quote } = fixture()
    prices.getSellQuote.mockImplementation(async (_market, quantity) => {
      mission.status = MissionStatus.FINALIZED
      return quote(quantity)
    })
    await service.runOnce(now)
    expect(database.order.create).not.toHaveBeenCalled()
    expect(database.missionResult.createMany).not.toHaveBeenCalled()
  })
})
