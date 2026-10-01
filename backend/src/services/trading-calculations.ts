import { MissionStatus, Prisma } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'
import { AppError } from '../errors/app-error.js'

export type DecimalInput = Decimal | string | number

export const MINIMUM_ORDER_NOTIONAL = new Prisma.Decimal(100)
export const POSITION_LIMIT_RATIO = new Prisma.Decimal('0.30')

export function decimal(value: DecimalInput) {
  return new Prisma.Decimal(value)
}

export function calculateWeightedAverageEntry(
  currentQuantity: DecimalInput,
  currentAverage: DecimalInput,
  addedQuantity: DecimalInput,
  executionPrice: DecimalInput,
) {
  const oldQuantity = decimal(currentQuantity)
  const newQuantity = decimal(addedQuantity)
  const totalQuantity = oldQuantity.plus(newQuantity)
  if (totalQuantity.isZero()) return decimal(0)
  return oldQuantity.mul(currentAverage).plus(newQuantity.mul(executionPrice)).div(totalQuantity)
}

export function calculateBuyPosition(
  currentQuantity: DecimalInput,
  currentAverage: DecimalInput,
  addedQuantity: DecimalInput,
  executionPrice: DecimalInput,
) {
  const quantity = decimal(currentQuantity).plus(addedQuantity)
  const averageEntryPrice = calculateWeightedAverageEntry(currentQuantity, currentAverage, addedQuantity, executionPrice)
  return { quantity, averageEntryPrice }
}

export function calculateSellPosition(
  currentQuantity: DecimalInput,
  averageEntryPrice: DecimalInput,
  accumulatedRealizedPnl: DecimalInput,
  soldQuantity: DecimalInput,
  executionPrice: DecimalInput,
) {
  const quantity = decimal(currentQuantity).minus(soldQuantity)
  const realizedPnlDelta = calculateRealizedPnl(soldQuantity, executionPrice, averageEntryPrice)
  return {
    quantity,
    averageEntryPrice: quantity.isZero() ? decimal(0) : decimal(averageEntryPrice),
    realizedPnlDelta,
    realizedPnl: decimal(accumulatedRealizedPnl).plus(realizedPnlDelta),
  }
}

export function calculateRealizedPnl(quantity: DecimalInput, executionPrice: DecimalInput, averageEntryPrice: DecimalInput) {
  return decimal(quantity).mul(decimal(executionPrice).minus(averageEntryPrice))
}

export function calculateUnrealizedPnl(quantity: DecimalInput, currentPrice: DecimalInput, averageEntryPrice: DecimalInput) {
  return decimal(quantity).mul(decimal(currentPrice).minus(averageEntryPrice))
}

export function calculateMarketValue(quantity: DecimalInput, currentPrice: DecimalInput) {
  return decimal(quantity).mul(currentPrice)
}

export function calculatePositionExposure(quantity: DecimalInput, currentPrice: DecimalInput, newOrderNotional: DecimalInput = 0) {
  return calculateMarketValue(quantity, currentPrice).plus(newOrderNotional)
}

export function calculateEquity(cashBalance: DecimalInput, marketValues: DecimalInput[]) {
  return marketValues.reduce<Decimal>((total, value) => total.plus(value), decimal(cashBalance))
}

export function calculateReturnPercent(totalEquity: DecimalInput, startingBalance: DecimalInput) {
  const starting = decimal(startingBalance)
  if (starting.isZero()) return decimal(0)
  return decimal(totalEquity).minus(starting).div(starting).mul(100)
}

export function assertMinimumOrder(notional: DecimalInput) {
  const value = decimal(notional)
  if (!value.isPositive()) throw new AppError('INVALID_ORDER', 'Order amount must be greater than zero.')
  if (value.lessThan(MINIMUM_ORDER_NOTIONAL)) {
    throw new AppError('ORDER_TOO_SMALL', 'Minimum order size is 100 virtual USDC.')
  }
}

export function assertSufficientBalance(cashBalance: DecimalInput, notional: DecimalInput) {
  if (decimal(cashBalance).lessThan(notional)) {
    throw new AppError('INSUFFICIENT_VIRTUAL_BALANCE', 'Not enough virtual USDC to execute this order.')
  }
}

export function assertSufficientPosition(availableQuantity: DecimalInput, requestedQuantity: DecimalInput) {
  const requested = decimal(requestedQuantity)
  if (!requested.isPositive()) throw new AppError('INVALID_ORDER', 'Sell quantity must be greater than zero.')
  if (decimal(availableQuantity).lessThan(requested)) {
    throw new AppError('INSUFFICIENT_POSITION', 'You cannot sell more than your current position.')
  }
}

export function assertPositionLimit(
  startingBalance: DecimalInput,
  currentQuantity: DecimalInput,
  currentPrice: DecimalInput,
  newOrderNotional: DecimalInput,
) {
  const maximumExposure = decimal(startingBalance).mul(POSITION_LIMIT_RATIO)
  const resultingExposure = calculatePositionExposure(currentQuantity, currentPrice, newOrderNotional)
  if (resultingExposure.greaterThan(maximumExposure)) {
    throw new AppError('POSITION_LIMIT_EXCEEDED', 'A single market cannot exceed 30% of starting virtual capital.')
  }
}

export function assertMissionTradingStatus(status: MissionStatus) {
  if (status !== MissionStatus.ACTIVE && status !== MissionStatus.BLACKOUT) {
    throw new AppError('MISSION_NOT_ACTIVE', 'Orders are accepted only while the mission is active.')
  }
}

export function assertMarketAvailable(enabled: boolean) {
  if (!enabled) throw new AppError('MARKET_NOT_AVAILABLE', 'This market is not available for trading.')
}
