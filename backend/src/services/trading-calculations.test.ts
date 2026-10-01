import { describe, expect, it } from 'vitest'
import { MissionStatus } from '@prisma/client'
import { AppError } from '../errors/app-error.js'
import {
  assertMinimumOrder,
  assertMarketAvailable,
  assertMissionTradingStatus,
  assertPositionLimit,
  assertSufficientBalance,
  assertSufficientPosition,
  calculateBuyPosition,
  calculateEquity,
  calculateMarketValue,
  calculatePositionExposure,
  calculateRealizedPnl,
  calculateReturnPercent,
  calculateSellPosition,
  calculateUnrealizedPnl,
} from './trading-calculations.js'

function expectCode(action: () => void, code: string) {
  try {
    action()
    throw new Error(`Expected ${code}`)
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe(code)
  }
}

describe('paper trading calculations', () => {
  it('calculates the first BUY average entry', () => {
    const position = calculateBuyPosition(0, 0, 100, 10)
    expect(position.quantity.toString()).toBe('100')
    expect(position.averageEntryPrice.toString()).toBe('10')
  })

  it('updates weighted average on a second BUY', () => {
    const position = calculateBuyPosition(100, 10, 100, 20)
    expect(position.quantity.toString()).toBe('200')
    expect(position.averageEntryPrice.toString()).toBe('15')
  })

  it('keeps average entry unchanged after a partial SELL', () => {
    const position = calculateSellPosition(100, 10, 0, 40, 15)
    expect(position.quantity.toString()).toBe('60')
    expect(position.averageEntryPrice.toString()).toBe('10')
    expect(position.realizedPnl.toString()).toBe('200')
  })

  it('resets position values after a full SELL', () => {
    const position = calculateSellPosition(100, 10, 0, 100, 15)
    expect(position.quantity.toString()).toBe('0')
    expect(position.averageEntryPrice.toString()).toBe('0')
  })

  it('calculates realized PnL', () => {
    expect(calculateRealizedPnl(40, 15, 10).toString()).toBe('200')
  })

  it('calculates unrealized PnL', () => {
    expect(calculateUnrealizedPnl(60, 15, 10).toString()).toBe('300')
  })

  it('rejects insufficient virtual balance', () => {
    expectCode(() => assertSufficientBalance(500, 600), 'INSUFFICIENT_VIRTUAL_BALANCE')
  })

  it('rejects insufficient position quantity', () => {
    expectCode(() => assertSufficientPosition(5, 6), 'INSUFFICIENT_POSITION')
  })

  it('enforces the 30% cap using current exposure plus the new BUY', () => {
    expectCode(() => assertPositionLimit(10_000, 200, 10, 1_001), 'POSITION_LIMIT_EXCEEDED')
    expect(() => assertPositionLimit(10_000, 200, 10, 1_000)).not.toThrow()
  })

  it('enforces the minimum order size', () => {
    expectCode(() => assertMinimumOrder('99.99'), 'ORDER_TOO_SMALL')
    expect(() => assertMinimumOrder(100)).not.toThrow()
  })

  it('calculates portfolio equity from cash and positions', () => {
    expect(calculateEquity(7_000, [2_000, 1_450]).toString()).toBe('10450')
  })

  it('calculates market value and proposed exposure', () => {
    expect(calculateMarketValue(25, 4).toString()).toBe('100')
    expect(calculatePositionExposure(25, 4, 50).toString()).toBe('150')
  })

  it('calculates return percent', () => {
    expect(calculateReturnPercent(10_450, 10_000).toString()).toBe('4.5')
  })

  it('rejects an inactive mission', () => {
    expectCode(() => assertMissionTradingStatus(MissionStatus.LOCKED), 'MISSION_NOT_ACTIVE')
    expect(() => assertMissionTradingStatus(MissionStatus.BLACKOUT)).not.toThrow()
  })

  it('rejects a disabled market', () => {
    expectCode(() => assertMarketAvailable(false), 'MARKET_NOT_AVAILABLE')
  })
})
