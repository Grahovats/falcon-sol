import type { ExitLevels } from '../../types/trading'

export function parseExitPrices(levels: { takeProfitPrice: string; stopLossPrice: string }, currentPrice: number): ExitLevels {
  const parse = (value: string) => value.trim() ? Number(value) : null
  const result = { takeProfitPrice: parse(levels.takeProfitPrice), stopLossPrice: parse(levels.stopLossPrice) }
  for (const price of [result.takeProfitPrice, result.stopLossPrice]) {
    if (price !== null && (!Number.isFinite(price) || price <= 0)) throw new Error('Enter a positive exit price, or leave the field empty.')
  }
  if (result.takeProfitPrice !== null && result.takeProfitPrice <= currentPrice) throw new Error('Take profit must be above the current price.')
  if (result.stopLossPrice !== null && result.stopLossPrice >= currentPrice) throw new Error('Stop loss must be below the current price.')
  return result
}


export function formatExitInput(value: string | number) {
  const price = Number(value)
  if (!Number.isFinite(price) || price <= 0) return ''
  const [mantissa, exponent = '0'] = price.toPrecision(5).split('e')
  const digits = mantissa.replace('.', '')
  const point = (mantissa.includes('.') ? mantissa.indexOf('.') : mantissa.length) + Number(exponent)
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length)
  return `${digits.slice(0, point)}.${digits.slice(point)}`
}
