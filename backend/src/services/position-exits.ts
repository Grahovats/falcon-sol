import { AppError } from '../errors/app-error.js'
import { decimal, type DecimalInput } from './trading-calculations.js'

export interface ExitLevels {
  takeProfitPrice: DecimalInput | null
  stopLossPrice: DecimalInput | null
}
export type ExitReason = 'TAKE_PROFIT' | 'STOP_LOSS'

export function validateExitLevels(levels: ExitLevels, currentPrice: DecimalInput) {
  const current = decimal(currentPrice)
  for (const level of [levels.takeProfitPrice, levels.stopLossPrice]) {
    if (level !== null && (!decimal(level).isFinite() || !decimal(level).greaterThan(0) || decimal(level).toDecimalPlaces(12).isZero() || decimal(level).greaterThanOrEqualTo('1e18'))) {
      throw new AppError('INVALID_ORDER', 'Exit prices must be positive and have at most 12 decimal places.')
    }
    if (level !== null && !decimal(level).equals(decimal(level).toDecimalPlaces(12))) throw new AppError('INVALID_ORDER', 'Exit prices support at most 12 decimal places.')
  }
  if (levels.takeProfitPrice !== null && decimal(levels.takeProfitPrice).lessThanOrEqualTo(current)) throw new AppError('INVALID_ORDER', 'Take profit must be above the current price.')
  if (levels.stopLossPrice !== null && decimal(levels.stopLossPrice).greaterThanOrEqualTo(current)) throw new AppError('INVALID_ORDER', 'Stop loss must be below the current price.')
}

export function triggeredExit(levels: ExitLevels, price: DecimalInput): ExitReason | null {
  const current = decimal(price)
  if (!current.isFinite() || !current.greaterThan(0)) return null
  if (levels.stopLossPrice !== null && current.lessThanOrEqualTo(levels.stopLossPrice)) return 'STOP_LOSS'
  if (levels.takeProfitPrice !== null && current.greaterThanOrEqualTo(levels.takeProfitPrice)) return 'TAKE_PROFIT'
  return null
}
