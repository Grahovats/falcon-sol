import { createHmac } from 'node:crypto'
import { AuditActorType, Prisma } from '@prisma/client'
import bs58 from 'bs58'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../errors/app-error.js'
import { getAdminUser } from '../services/admin-auth-service.js'
import { getAuthenticatedUser } from '../services/auth-service.js'
import { fundedPool, prepareAwards, rewardInclude, serializeRewards, cancelCashMission } from '../services/mission-rewards-service.js'
import { getTreasuryBalance, verifyTransfer } from '../services/solana-receipt-service.js'

const params = z.object({ id: z.string().min(1) })
const wallet = z.string().refine(value => { try { return bs58.decode(value).length === 32 } catch { return false } }, 'Invalid Solana wallet address.')
const cashAmount = z.number().positive().max(1e7).refine(n => new Prisma.Decimal(n).decimalPlaces() <= 6, 'Use at most six USDC decimals.')
const planSchema = z.object({ mode: z.enum(['SPONSORED', 'HYBRID']).default('SPONSORED'), sponsorName: z.string().trim().min(2).max(120), organizerName: z.string().trim().min(2).max(120), treasuryWallet: wallet, minimumPool: cashAmount, entryFee: z.number().min(0).max(1000).default(0), platformFeeBps: z.number().int().min(0).max(3000).default(1000), minimumEntrants: z.number().int().min(3).max(10000).default(3), fundingDeadline: z.coerce.date(), registrationClosesAt: z.coerce.date(), eligibleCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(100), rulesText: z.string().trim().min(100).max(15000), termsApproved: z.boolean().default(false) }).refine(p => p.mode === 'HYBRID' || p.entryFee === 0, { message: 'Sponsored missions must have free entry.' })
const fundingSchema = z.object({ sponsorName: z.string().trim().min(2).max(120), senderWallet: wallet, amount: cashAmount, signature: z.string().min(64).max(100) })
const receiptSchema = z.object({ signature: z.string().min(64).max(100) })
const load = (id: string) => prisma.missionRewardPlan.findUnique({ where: { missionId: id }, include: rewardInclude })

export const rewardRoutes: FastifyPluginAsync = async app => {
  app.get('/missions/:id/rewards', async request => { const { id } = params.parse(request.params); return { data: serializeRewards(await load(id)) } })
  app.get('/missions/:id/rewards/me', async request => {
    const { id } = params.parse(request.params); const user = await getAuthenticatedUser(prisma, request)
    return { data: await prisma.cashParticipant.findUnique({ where: { missionId_userId: { missionId: id, userId: user.id } }, select: { country: true, rulesVersion: true, status: true, verifiedAt: true, submittedAt: true } }) }
  })
  app.get('/admin/missions/:id/rewards', async request => {
    await getAdminUser(prisma, request); const { id } = params.parse(request.params)
    const participants = await prisma.cashParticipant.findMany({ where: { missionId: id }, include: { user: { select: { username: true, wallets: { select: { address: true }, take: 1 } } } }, orderBy: { submittedAt: 'asc' } })
    return { data: { rewards: serializeRewards(await load(id)), participants } }
  })
  app.post('/admin/missions/:id/rewards', async (request, reply) => {
    const actor = await getAdminUser(prisma, request); const { id } = params.parse(request.params); const input = planSchema.parse(request.body)
    const plan = await prisma.$transaction(async tx => {
      const mission = await tx.mission.findUnique({ where: { id }, include: { _count: { select: { entries: true } } } })
      if (!mission || !['DRAFT', 'REGISTRATION'].includes(mission.status) || mission._count.entries !== 0) throw new AppError('RULES_LOCKED', 'Configure prizes on a future mission before anyone registers.', 409)
      if (await tx.missionMarket.count({ where: { missionId: id, enabled: true } }) === 0) throw new AppError('FIXED_ROSTER_REQUIRED', 'Add the fixed market roster before configuring prizes.')
      if (mission.allowDynamicMarkets) throw new AppError('FIXED_ROSTER_REQUIRED', 'Cash missions require a fixed market roster. Turn off Open Arena first.')
      if (!mission.startingBalance.equals(10000)) throw new AppError('CAPITAL_REQUIRED', 'Cash missions use 10,000 virtual USDC for every entrant.')
      if (input.fundingDeadline <= new Date() || input.fundingDeadline.getTime() > mission.startsAt.getTime() - 48 * 3600000 || input.registrationClosesAt > mission.startsAt || input.registrationClosesAt <= input.fundingDeadline) throw new AppError('INVALID_DEADLINES', 'Funding must close at least 48 hours before the start, followed by a registration cutoff no later than the start.')
      const overlap = await tx.mission.findFirst({ where: { id: { not: id }, startsAt: { lt: mission.endsAt }, endsAt: { gt: mission.startsAt }, status: { not: 'CANCELLED' }, rewardPlan: { is: { state: { not: 'CANCELLED' } } } } })
      if (overlap) throw new AppError('CASH_MISSION_OVERLAP', 'Schedule one cash competition at a time. This window overlaps another prize mission.', 409)
      const created = await tx.missionRewardPlan.create({ data: { missionId: id, ...input }, include: rewardInclude })
      await audit(tx, actor, id, 'REWARD_PLAN_CREATED', { mode: input.mode, eligibleCountries: input.eligibleCountries, termsApproved: input.termsApproved })
      return created
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return reply.code(201).send({ data: serializeRewards(plan) })
  })
  app.post('/admin/missions/:id/rewards/funding', async (request, reply) => {
    const actor = await getAdminUser(prisma, request); const { id } = params.parse(request.params); const input = fundingSchema.parse(request.body)
    const current = await load(id)
    if (!current || !['FUNDING', 'READY'].includes(current.state) || new Date() >= current.registrationClosesAt) throw new AppError('FUNDING_CLOSED', 'The funding ledger is locked.', 409)
    const receipt = await verifyTransfer(input.signature, input.senderWallet, current.treasuryWallet, new Prisma.Decimal(input.amount))
    if (receipt.receivedAt < current.createdAt || receipt.receivedAt > current.fundingDeadline) throw new AppError('RECEIPT_OUTSIDE_WINDOW', 'Funding must have arrived after this plan was created and before its funding deadline.')
    const balance = await getTreasuryBalance(current.treasuryWallet)
    const plan = await prisma.$transaction(async tx => {
      const locked = await tx.missionRewardPlan.findUniqueOrThrow({ where: { missionId: id }, include: rewardInclude })
      if (!['FUNDING', 'READY'].includes(locked.state) || new Date() >= locked.registrationClosesAt) throw new AppError('FUNDING_CLOSED', 'The funding ledger is locked.', 409)
      if (balance.lessThan(fundedPool(locked).plus(input.amount))) throw new AppError('RESERVE_SHORTFALL', 'The treasury no longer covers the recorded reserve. Funding was not added.', 409)
      await tx.missionFunding.create({ data: { planId: locked.id, ...input, chainSlot: receipt.slot, receivedAt: receipt.receivedAt } })
      const total = fundedPool(locked).plus(input.amount)
      const updated = await tx.missionRewardPlan.update({ where: { id: locked.id }, data: { state: total.greaterThanOrEqualTo(locked.minimumPool) && locked.termsApproved && locked.mode === 'SPONSORED' ? 'READY' : 'FUNDING' }, include: rewardInclude })
      await audit(tx, actor, id, 'SPONSOR_FUNDING_VERIFIED', { signature: input.signature, amount: input.amount })
      return updated
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return reply.code(201).send({ data: serializeRewards(plan) })
  })
  app.post('/admin/missions/:id/rewards/participants/:userId', async request => {
    const actor = await getAdminUser(prisma, request); const { id, userId } = z.object({ id: z.string(), userId: z.string() }).parse(request.params)
    const input = z.object({ status: z.enum(['APPROVED', 'EXCLUDED']), verifiedCountry: z.string().regex(/^[A-Z]{2}$/), identityReference: z.string().trim().min(8).max(200), note: z.string().trim().min(10).max(1000) }).parse(request.body)
    if (!env.IDENTITY_HASH_SECRET) throw new AppError('IDENTITY_REVIEW_NOT_CONFIGURED', 'Configure IDENTITY_HASH_SECRET before approving prize eligibility.', 409)
    const identityHash = createHmac('sha256', env.IDENTITY_HASH_SECRET).update(input.identityReference).digest('hex')
    await prisma.$transaction(async tx => {
      const plan = await tx.missionRewardPlan.findUniqueOrThrow({ where: { missionId: id } })
      if (['FINAL', 'PAID', 'CANCELLED'].includes(plan.state) || plan.preparedBy) throw new AppError('REVIEW_LOCKED', 'Eligibility review is locked once awards have been prepared.', 409)
      const participant = await tx.cashParticipant.findUniqueOrThrow({ where: { missionId_userId: { missionId: id, userId } } })
      if (input.status === 'APPROVED' && participant.status !== 'APPROVED' && new Date() >= plan.registrationClosesAt) throw new AppError('REGISTRATION_CLOSED', 'New eligibility approvals must be completed before the published cutoff.', 409)
      if (input.status === 'APPROVED' && (!plan.eligibleCountries.includes(input.verifiedCountry) || participant.country !== input.verifiedCountry || participant.rulesVersion !== plan.rulesVersion)) throw new AppError('NOT_ELIGIBLE', 'Verified location and accepted rules must match this mission.')
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
      if (input.status === 'APPROVED' && await tx.user.findFirst({ where: { identityHash, id: { not: userId } } })) throw new AppError('NOT_ELIGIBLE', 'This verified person is already associated with another account.', 409)
      if (user.identityHash && user.identityHash !== identityHash) throw new AppError('IDENTITY_MISMATCH', 'The identity reference does not match the existing verified person.', 409)
      if (input.status === 'APPROVED') await tx.user.update({ where: { id: userId }, data: { identityHash } })
      await tx.cashParticipant.update({ where: { missionId_userId: { missionId: id, userId } }, data: { status: input.status, verifiedAt: new Date(), reviewNote: input.note } })
      await audit(tx, actor, id, 'PARTICIPANT_REVIEWED', { userId, status: input.status, note: input.note })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { data: { reviewed: true } }
  })
  app.post('/admin/missions/:id/rewards/prepare-awards', async request => {
    const actor = await getAdminUser(prisma, request); const { id } = params.parse(request.params)
    await prisma.$transaction(async tx => { await prepareAwards(tx, id, actor.user.id); await audit(tx, actor, id, 'AWARDS_PREPARED', {}) }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { data: serializeRewards(await load(id)) }
  })
  app.post('/admin/missions/:id/rewards/reset-awards', async request => {
    const actor = await getAdminUser(prisma, request); const { id } = params.parse(request.params)
    const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(request.body)
    await prisma.$transaction(async tx => {
      const plan = await tx.missionRewardPlan.findUniqueOrThrow({ where: { missionId: id } })
      if (plan.state !== 'REVIEW') throw new AppError('REVIEW_LOCKED', 'Approved awards cannot be reopened.', 409)
      await tx.missionAward.deleteMany({ where: { planId: plan.id } })
      await tx.missionRewardPlan.update({ where: { id: plan.id }, data: { preparedBy: null, approvedBy: null } })
      await audit(tx, actor, id, 'AWARDS_REOPENED_FOR_REVIEW', { reason })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { data: serializeRewards(await load(id)) }
  })
  app.post('/admin/missions/:id/rewards/approve-awards', async request => {
    const actor = await getAdminUser(prisma, request); const { id } = params.parse(request.params)
    await prisma.$transaction(async tx => {
      const plan = await tx.missionRewardPlan.findUniqueOrThrow({ where: { missionId: id }, include: rewardInclude })
      if (plan.state !== 'REVIEW' || !plan.preparedBy || plan.preparedBy === actor.user.id || !plan.awards.length || !plan.lockedPool || !plan.awards.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0)).equals(plan.lockedPool)) throw new AppError('SECOND_REVIEW_REQUIRED', 'A different administrator must approve a complete, prepared award allocation.', 409)
      await tx.missionAward.updateMany({ where: { planId: plan.id }, data: { status: 'APPROVED' } })
      await tx.missionRewardPlan.update({ where: { id: plan.id }, data: { state: 'FINAL', approvedBy: actor.user.id, approvedAt: new Date(), payoutDueAt: new Date(Date.now() + 72 * 3600000) } })
      await audit(tx, actor, id, 'AWARDS_APPROVED', {})
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { data: serializeRewards(await load(id)) }
  })
  app.post('/admin/missions/:id/rewards/awards/:awardId/receipt', async request => {
    const actor = await getAdminUser(prisma, request); const { id, awardId } = z.object({ id: z.string(), awardId: z.string() }).parse(request.params); const { signature } = receiptSchema.parse(request.body)
    const plan = await load(id); const award = plan?.awards.find(a => a.id === awardId)
    if (!plan || plan.state !== 'FINAL' || !award || award.status !== 'APPROVED') throw new AppError('AWARD_NOT_PAYABLE', 'This award is not approved for payment.', 409)
    const receipt = await verifyTransfer(signature, plan.treasuryWallet, award.walletAddress, award.amount)
    if (receipt.receivedAt < (plan.approvedAt ?? new Date())) throw new AppError('INVALID_RECEIPT', 'The award transfer must follow award approval.')
    await prisma.$transaction(async tx => {
      const changed = await tx.missionAward.updateMany({ where: { id: awardId, planId: plan.id, status: 'APPROVED' }, data: { status: 'PAID', payoutSignature: signature, paidAt: receipt.receivedAt } })
      if (changed.count !== 1) throw new AppError('AWARD_ALREADY_CHANGED', 'The award has already been updated.', 409)
      if (await tx.missionAward.count({ where: { planId: plan.id, status: { not: 'PAID' } } }) === 0) await tx.missionRewardPlan.update({ where: { id: plan.id }, data: { state: 'PAID' } })
      await audit(tx, actor, id, 'AWARD_TRANSFER_VERIFIED', { awardId, signature })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { data: serializeRewards(await load(id)) }
  })
  app.post('/admin/missions/:id/rewards/cancel', async request => {
    const actor = await getAdminUser(prisma, request); const { id } = params.parse(request.params); const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(request.body)
    const plan = await load(id)
    if (!plan || ['FINAL', 'PAID', 'CANCELLED'].includes(plan.state)) throw new AppError('CANCELLATION_UNAVAILABLE', 'This prize mission cannot be cancelled through this action.', 409)
    await cancelCashMission(prisma, id, reason)
    await prisma.adminAuditLog.create({ data: { actorType: 'ADMIN', actorUserId: actor.user.id, actorWallet: actor.walletAddress, action: 'CASH_CANCELLATION_REQUESTED', entityType: 'MissionRewardPlan', entityId: plan.id, missionId: id, metadata: { reason } } })
    return { data: serializeRewards(await load(id)) }
  })
  app.post('/admin/missions/:id/rewards/funding/:fundingId/return-receipt', async request => {
    const actor = await getAdminUser(prisma, request); const { id, fundingId } = z.object({ id: z.string(), fundingId: z.string() }).parse(request.params); const { signature } = receiptSchema.parse(request.body)
    const plan = await load(id); const funding = plan?.funding.find(f => f.id === fundingId)
    if (!plan || plan.state !== 'CANCELLED' || !funding || funding.returnedAt) throw new AppError('RETURN_UNAVAILABLE', 'This sponsor return is not pending.', 409)
    const receipt = await verifyTransfer(signature, plan.treasuryWallet, funding.senderWallet, funding.amount)
    if (receipt.receivedAt < plan.updatedAt) throw new AppError('INVALID_RECEIPT', 'The sponsor return must follow cancellation.')
    await prisma.$transaction(async tx => {
      const changed = await tx.missionFunding.updateMany({ where: { id: fundingId, returnedAt: null }, data: { returnSignature: signature, returnedAt: receipt.receivedAt } })
      if (changed.count !== 1) throw new AppError('ALREADY_RETURNED', 'This receipt has already been recorded.', 409)
      await audit(tx, actor, id, 'SPONSOR_RETURN_VERIFIED', { fundingId, signature })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { data: serializeRewards(await load(id)) }
  })
}

async function audit(tx: Prisma.TransactionClient, actor: Awaited<ReturnType<typeof getAdminUser>>, missionId: string, action: string, metadata: Prisma.InputJsonValue) {
  await tx.adminAuditLog.create({ data: { actorType: AuditActorType.ADMIN, actorUserId: actor.user.id, actorWallet: actor.walletAddress, action, entityType: 'MissionRewardPlan', entityId: missionId, missionId, metadata } })
}
