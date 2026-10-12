import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { allocateAwards, assertCashEntry } from './reward-calculations.js'
const amount = (value: string | number) => new Prisma.Decimal(value)
const results = (...values: number[]) => values.map((equity, i) => ({ userId: `user-${i}`, equity: amount(equity) }))
describe('cash award allocation', () => {
  it('allocates the full reserve 50/30/20', () => {
    expect(allocateAwards(amount(150), results(11000, 10500, 9000, 8000)).map(a => [a.rank, a.amount.toString()])).toEqual([[1, '75'], [2, '45'], [3, '30']])
  })
  it('shares the combined positions for tied winners', () => {
    expect(allocateAwards(amount(150), results(11000, 11000, 9000)).map(a => [a.rank, a.amount.toString()])).toEqual([[1, '60'], [1, '60'], [3, '30']])
  })
  it('includes a tie crossing the third place boundary', () => {
    expect(allocateAwards(amount(150), results(11000, 10000, 9000, 9000)).map(a => a.amount.toString())).toEqual(['75', '45', '15', '15'])
  })
  it('conserves every USDC micro-unit with deterministic rounding', () => {
    const rows = results(1, 1, 1, 1, 1, 1, 1)
    const forward = allocateAwards(amount('0.000011'), rows)
    expect(forward.reduce((sum, a) => sum.plus(a.amount), amount(0)).toString()).toBe('0.000011')
    expect(allocateAwards(amount('0.000011'), rows.reverse())).toEqual(forward)
    expect(forward.every(a => a.amount.decimalPlaces() <= 6)).toBe(true)
  })
  it.each(['-1', 'NaN', 'Infinity', '0.0000001'])('rejects an invalid reserve %s', value => expect(() => allocateAwards(amount(value), results(1, 2, 3))).toThrow())
})
describe('cash registration gate', () => {
  const now = new Date('2026-10-12T12:00:00Z')
  const plan = { mode: 'SPONSORED', state: 'READY', termsApproved: true, registrationClosesAt: new Date('2026-10-13T12:00:00Z'), eligibleCountries: ['RS'], rulesVersion: 1 }
  const input = { country: 'RS', rulesVersion: 1, adult: true }
  it('accepts a funded free mission before cutoff', () => expect(() => assertCashEntry(plan, input, now)).not.toThrow())
  it('rejects the exact cutoff', () => expect(() => assertCashEntry(plan, input, plan.registrationClosesAt)).toThrow('closed'))
  it('rejects unfunded events and unreviewed rules', () => {
    expect(() => assertCashEntry({ ...plan, state: 'FUNDING' }, input, now)).toThrow('funding')
    expect(() => assertCashEntry({ ...plan, termsApproved: false }, input, now)).toThrow('review')
  })
  it('blocks paid entry, ineligible countries, minors and stale rules', () => {
    expect(() => assertCashEntry({ ...plan, mode: 'HYBRID' }, input, now)).toThrow('Paid entry')
    expect(() => assertCashEntry(plan, { ...input, country: 'US' }, now)).toThrow('eligible')
    expect(() => assertCashEntry(plan, { ...input, adult: false }, now)).toThrow('adult')
    expect(() => assertCashEntry(plan, { ...input, rulesVersion: 2 }, now)).toThrow('current mission rules')
  })
})
