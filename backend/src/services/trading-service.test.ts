import { MissionStatus, Prisma, type PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { TradingService } from './trading-service.js'
import type { ExecutionQuote, MarketDataService } from './price-service.js'

const d = (value: number) => new Prisma.Decimal(value)
const input = { missionId: 'mission', marketId: 'market', userId: 'user' }
function fixture() {
  const mission = { status: MissionStatus.ACTIVE, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 60_000) }
  const market = { id: 'market', missionId: 'mission', symbol: 'COIN', mintAddress: 'mint', decimals: 6, enabled: true }
  const entry = { id: 'entry', missionId: 'mission', userId: 'user', startingBalance: d(10000), cashBalance: d(9000), realizedPnl: d(0) }
  const position = { id: 'position', missionMarketId: 'market', quantity: d(10), averageEntryPrice: d(100), realizedPnl: d(0), takeProfitPrice: d(120), stopLossPrice: d(80), protectionVersion: 3 }
  const quote: ExecutionQuote = { provider: 'mock', inputMint: 'mint', outputMint: 'USDC', inputAmount: '10000000', outputAmount: '1200000000', quantity: d(10), notional: d(1200), executionPrice: d(120), referencePrice: d(120), simulatedFee: d(0), priceImpactPercent: d(0), requestId: null, quoteId: null, router: null, quotedAt: new Date(), expiresAt: null, routePlan: [] }
  const database = {
    mission: { findUnique: vi.fn().mockResolvedValue(mission) },
    missionMarket: { findFirst: vi.fn().mockResolvedValue(market) },
    missionEntry: { findUnique: vi.fn().mockResolvedValue(entry), update: vi.fn() },
    position: { findUnique: vi.fn().mockResolvedValue(position), update: vi.fn(), upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    order: { create: vi.fn().mockResolvedValue({ id: 'order' }), update: vi.fn().mockResolvedValue({ id: 'order', requestedNotional: d(1200), requestedQuantity: d(10) }) },
    fill: { create: vi.fn().mockResolvedValue({ ...quote, executionPrice: d(120), referencePrice: d(120), simulatedFee: d(0), quantity: d(10), notional: d(1200), priceImpactPct: null }) },
    $transaction: vi.fn(),
  }
  database.$transaction.mockImplementation(async (operation: (tx: typeof database) => Promise<unknown>) => operation(database))
  const prices = { getSellQuote: vi.fn().mockResolvedValue(quote), getBuyQuote: vi.fn().mockResolvedValue({ ...quote, inputMint: 'USDC', outputMint: 'mint', referencePrice: d(100) }), getPrice: vi.fn().mockResolvedValue({ marketId: 'market', price: d(120), asOf: new Date() }) }
  const service = new TradingService(database as unknown as PrismaClient, prices as unknown as MarketDataService)
  vi.spyOn(service, 'calculatePortfolio').mockResolvedValue({ entryId: 'entry', userId: 'user', startingBalance: '10000', cashBalance: '10200', realizedPnl: '200', unrealizedPnl: '0', totalEquity: '10200', totalPnl: '200', returnPercent: '2', positions: [] })
  return { database, prices, service, position, quote, market, entry }
}

describe('position exit execution', () => {
  it('records the exit reason, credits actual proceeds, and cancels both sibling levels', async () => {
    const { service, database } = fixture()
    await service.placeSellOrder({ ...input, quantity: 10, trigger: { version: 3, reason: 'TAKE_PROFIT', price: 120 } })
    expect(database.order.create.mock.calls[0]?.[0].data.exitReason).toBe('TAKE_PROFIT')
    expect(database.missionEntry.update.mock.calls[0]?.[0].data.cashBalance.toString()).toBe('10200')
    expect(database.position.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ takeProfitPrice: null, stopLossPrice: null, protectionVersion: { increment: 1 } }) }))
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  })
  it('does not execute a stale worker snapshot after a manual trade or level edit', async () => {
    const { service, database } = fixture()
    await expect(service.placeSellOrder({ ...input, quantity: 10, trigger: { version: 2, reason: 'TAKE_PROFIT', price: 120 } })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(database.order.create).not.toHaveBeenCalled()
    expect(database.missionEntry.update).not.toHaveBeenCalled()
  })
  it('rejects a mismatched trigger or unusable quote without creating a fill', async () => {
    const { service, database, prices, quote } = fixture()
    await expect(service.placeSellOrder({ ...input, quantity: 10, trigger: { version: 3, reason: 'STOP_LOSS', price: 120 } })).rejects.toMatchObject({ code: 'CONFLICT' })
    prices.getSellQuote.mockResolvedValue({ ...quote, quantity: d(0) })
    await expect(service.placeSellOrder({ ...input, quantity: 10 })).rejects.toMatchObject({ code: 'QUOTE_UNAVAILABLE' })
    expect(database.order.create).not.toHaveBeenCalled()
    expect(database.fill.create).not.toHaveBeenCalled()
  })
  it('does not execute after a position was closed or the mission ended', async () => {
    const { service, database, position } = fixture()
    database.position.findUnique.mockResolvedValue({ ...position, quantity: d(0) })
    await expect(service.placeSellOrder({ ...input, quantity: 10, trigger: { version: 3, reason: 'TAKE_PROFIT', price: 120 } })).rejects.toMatchObject({ code: 'INSUFFICIENT_POSITION' })
    database.mission.findUnique.mockResolvedValue({ status: MissionStatus.FINALIZED, startsAt: new Date(0), endsAt: new Date(1) })
    await expect(service.placeSellOrder({ ...input, quantity: 10 })).rejects.toMatchObject({ code: 'MISSION_NOT_ACTIVE' })
    expect(database.order.create).not.toHaveBeenCalled()
  })
  it('retains exits for a manual partial sell and removes them on a full sell', async () => {
    const { service, database, prices, quote } = fixture()
    prices.getSellQuote.mockResolvedValue({ ...quote, quantity: d(5), notional: d(600) })
    await service.placeSellOrder({ ...input, quantity: 5 })
    expect(database.position.update.mock.calls[0]?.[0].data).not.toHaveProperty('takeProfitPrice')
    prices.getSellQuote.mockResolvedValue(quote)
    await service.placeSellOrder({ ...input, quantity: 10 })
    expect(database.position.update.mock.calls[1]?.[0].data).toMatchObject({ takeProfitPrice: null, stopLossPrice: null })
  })
  it('saves buy exits within the same transaction as the fill', async () => {
    const { service, database } = fixture()
    await service.placeBuyOrder({ ...input, notional: 1000, takeProfitPrice: 130, stopLossPrice: 90 })
    expect(database.position.upsert.mock.calls[0]?.[0].update.takeProfitPrice.toString()).toBe('130')
    expect(database.position.upsert.mock.calls[0]?.[0].update.stopLossPrice.toString()).toBe('90')
    expect(database.$transaction).toHaveBeenCalledTimes(1)
  })
  it('rejects unauthorized ownership and saving exits without an open position', async () => {
    const { service, database, position } = fixture()
    database.missionEntry.findUnique.mockResolvedValue(null)
    await expect(service.updatePositionExits({ ...input, takeProfitPrice: 130, stopLossPrice: 90 })).rejects.toMatchObject({ code: 'MISSION_ENTRY_NOT_FOUND' })
    expect(database.position.update).not.toHaveBeenCalled()
    database.missionEntry.findUnique.mockResolvedValue({ id: 'entry' })
    database.position.findUnique.mockResolvedValue({ ...position, quantity: d(0) })
    await expect(service.updatePositionExits({ ...input, takeProfitPrice: 130, stopLossPrice: 90 })).rejects.toMatchObject({ code: 'INSUFFICIENT_POSITION' })
  })
  it('runs offline, skips stale prices, and isolates failures between positions', async () => {
    const { service, database, prices, position, market, entry } = fixture()
    database.position.findMany.mockResolvedValue([{ ...position, missionMarket: market, missionEntry: entry }, { ...position, id: 'second', missionMarket: market, missionEntry: { ...entry, userId: 'second' } }])
    const sell = vi.spyOn(service, 'placeSellOrder').mockRejectedValueOnce(new Error('Quote unavailable')).mockResolvedValue({ order: {} as never, fill: {} as never, portfolio: {} as never })
    const onError = vi.fn()
    await service.processPositionExits(new Date(), onError)
    expect(sell).toHaveBeenCalledTimes(2)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(sell.mock.calls[0]?.[0]).toMatchObject({ quantity: d(10), trigger: { version: 3, reason: 'TAKE_PROFIT' } })
    sell.mockClear()
    prices.getPrice.mockResolvedValue({ marketId: 'market', price: d(120), asOf: new Date(Date.now() - 60_000) })
    await service.processPositionExits(new Date(), onError)
    expect(sell).not.toHaveBeenCalled()
  })
})
