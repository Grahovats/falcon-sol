import { Prisma } from '@prisma/client'
import { AppError } from '../errors/app-error.js'

export const PRIZE_SPLIT = [50, 30, 20] as const
export const SETTLEMENT_WINDOW_MS = 60_000
export const REVIEW_DURATION_MS = 48 * 60 * 60 * 1000
export const PAYOUT_DURATION_MS = 72 * 60 * 60 * 1000

/** All equal-equity entrants share the prizes for the positions they occupy. */
export function allocateAwards(pool: Prisma.Decimal, results: Array<{ userId: string; equity: Prisma.Decimal }>) {
  if (!pool.isFinite() || pool.lessThan(0) || pool.decimalPlaces() > 6) throw new AppError('INVALID_POOL', 'Prize reserve must be a non-negative USDC amount with at most six decimals.')
  const units = BigInt(pool.mul(1e6).toFixed(0))
  const budgets = PRIZE_SPLIT.map(percent => units * BigInt(percent) / 100n)
  budgets[0] = (budgets[0] ?? 0n) + units - budgets.reduce((sum, value) => sum + value, 0n)
  const ranked = [...results].sort((a, b) => b.equity.comparedTo(a.equity) || a.userId.localeCompare(b.userId))
  const awards: Array<{ userId: string; rank: number; amount: Prisma.Decimal }> = []
  for (let offset = 0; offset < ranked.length;) {
    let end = offset + 1
    while (end < ranked.length && ranked[end]!.equity.equals(ranked[offset]!.equity)) end++
    const groupBudget = budgets.slice(offset, end).reduce((sum, value) => sum + value, 0n)
    const count = BigInt(end - offset)
    const share = groupBudget / count
    const remainder = groupBudget % count
    for (let i = offset; i < end; i++) {
      const amount = share + (BigInt(i - offset) < remainder ? 1n : 0n)
      if (amount > 0) awards.push({ userId: ranked[i]!.userId, rank: offset + 1, amount: new Prisma.Decimal(amount.toString()).div(1e6) })
    }
    offset = end
  }
  return awards
}

export function assertCashEntry(plan: { mode: string; state: string; termsApproved: boolean; registrationClosesAt: Date; eligibleCountries: string[]; rulesVersion: number }, input: { country: string; rulesVersion: number; adult: boolean }, now = new Date()) {
  if (plan.mode !== 'SPONSORED') throw new AppError('PAID_ENTRY_UNAVAILABLE', 'Paid entry is not available. No payment will be requested.', 409)
  if (plan.state !== 'READY' || !plan.termsApproved) throw new AppError('PRIZE_REGISTRATION_UNAVAILABLE', 'Prize registration opens after funding and organizer review.', 409)
  if (now >= plan.registrationClosesAt) throw new AppError('REGISTRATION_CLOSED', 'Prize registration has closed.', 409)
  if (!input.adult || !plan.eligibleCountries.includes(input.country)) throw new AppError('NOT_ELIGIBLE', 'This prize mission requires an adult entrant in an eligible country.', 403)
  if (input.rulesVersion !== plan.rulesVersion) throw new AppError('RULES_CHANGED', 'Read and accept the current mission rules before registering.', 409)
}
