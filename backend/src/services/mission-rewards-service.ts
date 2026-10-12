import { AuditActorType, Prisma, type MissionRewardPlan, type MissionFunding, type MissionAward, type PrismaClient } from '@prisma/client'
import { AppError } from '../errors/app-error.js'
import { allocateAwards, REVIEW_DURATION_MS, PAYOUT_DURATION_MS } from './reward-calculations.js'

export const rewardInclude = { funding: { orderBy: { verifiedAt: 'asc' as const } }, awards: { orderBy: { rank: 'asc' as const } } } as const
export type RewardRecord = MissionRewardPlan & { funding: MissionFunding[]; awards: MissionAward[] }

export function fundedPool(plan: Pick<RewardRecord, 'funding'>) {
  return plan.funding.filter(receipt => !receipt.returnedAt).reduce((sum, receipt) => sum.plus(receipt.amount), new Prisma.Decimal(0))
}

export function serializeRewards(plan: RewardRecord | null | undefined) {
  if (!plan) return null
  const pool = plan.lockedPool ?? fundedPool(plan)
  return {
    mode: plan.mode, state: plan.state, sponsorName: plan.sponsorName, organizerName: plan.organizerName,
    treasuryWallet: plan.treasuryWallet, minimumPool: plan.minimumPool.toString(), fundedPool: fundedPool(plan).toString(), prizePool: pool.toString(),
    entryFee: plan.entryFee.toString(), platformFeeBps: plan.platformFeeBps, paidEntryAvailable: false,
    minimumEntrants: plan.minimumEntrants, eligibleCountries: plan.eligibleCountries, fundingDeadline: plan.fundingDeadline.toISOString(), registrationClosesAt: plan.registrationClosesAt.toISOString(),
    rulesText: plan.rulesText, rulesVersion: plan.rulesVersion, termsApproved: plan.termsApproved, lockedAt: plan.lockedAt?.toISOString() ?? null,
    reviewEndsAt: plan.reviewEndsAt?.toISOString() ?? null, payoutDueAt: plan.payoutDueAt?.toISOString() ?? null, cancelReason: plan.cancelReason,
    payoutSplit: [50, 30, 20], indicativePrizes: [50, 30, 20].map(percent => pool.mul(percent).div(100).toFixed(6)),
    funding: plan.funding.map(f => ({ id: f.id, sponsorName: f.sponsorName, amount: f.amount.toString(), signature: f.signature, receivedAt: f.receivedAt.toISOString(), returnedAt: f.returnedAt?.toISOString() ?? null, returnSignature: f.returnSignature })),
    awards: plan.awards.map(a => ({ id: a.id, userId: a.userId, displayName: a.displayName, walletAddress: a.walletAddress, rank: a.rank, amount: a.amount.toString(), status: a.status, payoutSignature: a.payoutSignature, paidAt: a.paidAt?.toISOString() ?? null })),
  }
}

export async function cancelCashMission(database: PrismaClient, missionId: string, reason: string) {
  await database.$transaction(async tx => {
    const plan = await tx.missionRewardPlan.findUnique({ where: { missionId } })
    if (!plan || ['FINAL', 'PAID', 'CANCELLED'].includes(plan.state)) return
    await tx.missionRewardPlan.update({ where: { missionId }, data: { state: 'CANCELLED', cancelReason: reason } })
    await tx.mission.update({ where: { id: missionId }, data: { status: 'CANCELLED', lifecycleError: null } })
    await tx.adminAuditLog.create({ data: { actorType: AuditActorType.SYSTEM, action: 'CASH_MISSION_CANCELLED', entityType: 'MissionRewardPlan', entityId: plan.id, missionId, metadata: { reason, sponsorReturnsRequired: true } } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function prepareAwards(tx: Prisma.TransactionClient, missionId: string, actorUserId: string) {
  const plan = await tx.missionRewardPlan.findUnique({ where: { missionId }, include: rewardInclude })
  if (!plan || plan.state !== 'REVIEW' || !plan.lockedPool || !plan.reviewEndsAt || new Date() < plan.reviewEndsAt) throw new AppError('REVIEW_NOT_COMPLETE', 'Awards can be prepared after the 48-hour review period.', 409)
  const approved = await tx.cashParticipant.findMany({ where: { missionId, status: 'APPROVED' }, select: { userId: true } })
  const results = await tx.missionResult.findMany({ where: { missionId, userId: { in: approved.map(p => p.userId) } } })
  const qualifiers = await tx.order.findMany({ where: { missionEntry: { missionId }, status: 'FILLED', side: 'BUY', requestedNotional: { gte: 100 } }, select: { missionEntry: { select: { userId: true } } } })
  const qualifiedIds = new Set(qualifiers.map(order => order.missionEntry.userId))
  const eligibleResults = results.filter(result => qualifiedIds.has(result.userId) && result.walletAddress)
  if (eligibleResults.length < plan.minimumEntrants) throw new AppError('INSUFFICIENT_QUALIFIERS', 'Not enough eligible traders qualified. Cancel the prize mission and return the sponsor reserve under its rules.', 409)
  const allocations = allocateAwards(plan.lockedPool, eligibleResults)
  await tx.missionAward.deleteMany({ where: { planId: plan.id } })
  for (const allocation of allocations) {
    const result = eligibleResults.find(r => r.userId === allocation.userId)!
    await tx.missionAward.create({ data: { planId: plan.id, ...allocation, displayName: result.displayName, walletAddress: result.walletAddress! } })
  }
  await tx.missionRewardPlan.update({ where: { id: plan.id }, data: { preparedBy: actorUserId, approvedBy: null } })
}

export function reviewDates(now: Date) { return { state: 'REVIEW', reviewEndsAt: new Date(now.getTime() + REVIEW_DURATION_MS), payoutDueAt: new Date(now.getTime() + REVIEW_DURATION_MS + PAYOUT_DURATION_MS) } }
