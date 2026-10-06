import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { triggeredExit, validateExitLevels } from './position-exits.js'

const levels = { takeProfitPrice: '120', stopLossPrice: '80' }
describe('position exit prices', () => {
  it('triggers at the threshold and after a gap across it', () => {
    expect(triggeredExit(levels, '100')).toBeNull()
    expect(triggeredExit(levels, '120')).toBe('TAKE_PROFIT')
    expect(triggeredExit(levels, '130')).toBe('TAKE_PROFIT')
    expect(triggeredExit(levels, '80')).toBe('STOP_LOSS')
    expect(triggeredExit(levels, '60')).toBe('STOP_LOSS')
  })
  it('allows either level to be absent and removes both with null', () => {
    expect(triggeredExit({ takeProfitPrice: null, stopLossPrice: '80' }, '150')).toBeNull()
    expect(triggeredExit({ takeProfitPrice: '120', stopLossPrice: null }, '60')).toBeNull()
    expect(triggeredExit({ takeProfitPrice: null, stopLossPrice: null }, '120')).toBeNull()
    expect(() => validateExitLevels({ takeProfitPrice: null, stopLossPrice: null }, '100')).not.toThrow()
  })
  it('rejects immediately crossed, invalid, and unrepresentable levels', () => {
    for (const takeProfitPrice of ['100', '99', '-1', 'NaN', 'Infinity', '1e18']) {
      expect(() => validateExitLevels({ takeProfitPrice, stopLossPrice: null }, '100')).toThrow()
    }
    for (const stopLossPrice of ['100', '101', '0', '0.0000000000001']) {
      expect(() => validateExitLevels({ takeProfitPrice: null, stopLossPrice }, '100')).toThrow()
    }
    expect(() => validateExitLevels({ takeProfitPrice: new Prisma.Decimal('0.000002'), stopLossPrice: '0.000000000001' }, '0.000001')).not.toThrow()
  })
  it('never triggers on invalid market prices', () => {
    for (const price of ['0', '-1', 'NaN', 'Infinity']) expect(triggeredExit(levels, price)).toBeNull()
  })
})
