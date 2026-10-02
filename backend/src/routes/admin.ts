import { AuditActorType, MissionStatus, Prisma } from '@prisma/client'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { AppError } from '../errors/app-error.js'
import { prisma } from '../lib/prisma.js'
import { getAdminUser } from '../services/admin-auth-service.js'

const missionStatuses = Object.values(MissionStatus) as [MissionStatus, ...MissionStatus[]]
const missionIdSchema = z.object({ id: z.string().min(1) })
const marketParamsSchema = z.object({ id: z.string().min(1), marketId: z.string().min(1) })
const missionFields = {
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2_000).nullable().optional(),
  startingBalance: z.number().positive().max(1_000_000_000),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  status: z.enum(missionStatuses),
  allowDynamicMarkets: z.boolean().optional(),
}
const createMissionSchema = z.object({ ...missionFields, slug: z.string().trim().min(3).max(140).optional() })
  .refine((value) => value.endsAt > value.startsAt, { message: 'End time must be after start time.' })
  .refine((value) => ([MissionStatus.DRAFT, MissionStatus.REGISTRATION, MissionStatus.LOCKED] as MissionStatus[]).includes(value.status), { message: 'New missions must begin as DRAFT, REGISTRATION, or LOCKED.' })
const updateMissionSchema = z.object(missionFields).partial().refine((value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt, { message: 'End time must be after start time.' })
const createMarketSchema = z.object({ symbol: z.string().trim().min(2).max(20).transform((value) => value.toUpperCase()), mintAddress: z.string().trim().min(32).max(64), decimals: z.number().int().min(0).max(18).default(6), enabled: z.boolean().default(true) })
const updateMarketSchema = createMarketSchema.partial()
type AdminIdentity = Awaited<ReturnType<typeof getAdminUser>>

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const identities = new WeakMap<FastifyRequest, AdminIdentity>()
  app.addHook('preHandler', async (request) => { identities.set(request, await getAdminUser(prisma, request)) })
  const identityFor = (request: FastifyRequest) => {
    const identity = identities.get(request)
    if (!identity) throw new AppError('ADMIN_ACCESS_REQUIRED', 'Administrator identity was not established.', 403)
    return identity
  }

  app.get('/admin/missions', async () => {
    const missions = await prisma.mission.findMany({ include: { markets: { orderBy: { symbol: 'asc' } }, _count: { select: { entries: true, results: true } } }, orderBy: { createdAt: 'desc' } })
    return { data: missions.map(serializeAdminMission) }
  })

  app.get('/admin/audit-logs', async () => {
    const logs = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return { data: logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })) }
  })

  app.post('/admin/missions', async (request, reply) => {
    const input = createMissionSchema.parse(request.body)
    const actor = identityFor(request)
    try {
      const mission = await prisma.$transaction(async (transaction) => {
        const created = await transaction.mission.create({
          data: { name: input.name, slug: input.slug ?? slugify(input.name), description: input.description ?? null, startingBalance: input.startingBalance, startsAt: input.startsAt, endsAt: input.endsAt, status: input.status, allowDynamicMarkets: input.allowDynamicMarkets ?? false },
          include: { markets: true, _count: { select: { entries: true, results: true } } },
        })
        await writeAdminAudit(transaction, actor, 'MISSION_CREATED', 'Mission', created.id, created.id, { name: created.name, status: created.status, startsAt: created.startsAt.toISOString(), endsAt: created.endsAt.toISOString() })
        return created
      })
      return reply.code(201).send({ data: serializeAdminMission(mission) })
    } catch (error: unknown) { handleUniqueConflict(error, 'A mission with this slug already exists.') }
  })

  app.patch('/admin/missions/:id', async (request) => {
    const { id } = missionIdSchema.parse(request.params)
    const input = updateMissionSchema.parse(request.body)
    const actor = identityFor(request)
    const mission = await prisma.$transaction(async (transaction) => {
      const current = await transaction.mission.findUnique({ where: { id } })
      if (!current) throw new AppError('MISSION_NOT_FOUND', 'Mission not found.', 404)
      const startsAt = input.startsAt ?? current.startsAt
      const endsAt = input.endsAt ?? current.endsAt
      if (endsAt <= startsAt) throw new AppError('VALIDATION_ERROR', 'End time must be after start time.')
      if (input.status !== undefined) assertAdminStatusTransition(current.status, input.status)
      assertMissionRulesMutable(current, input)

      const data: Prisma.MissionUpdateInput = {}
      if (input.name !== undefined) data.name = input.name
      if (input.description !== undefined) data.description = input.description
      if (input.startingBalance !== undefined) data.startingBalance = input.startingBalance
      if (input.startsAt !== undefined) data.startsAt = input.startsAt
      if (input.endsAt !== undefined) data.endsAt = input.endsAt
      if (input.status !== undefined) data.status = input.status
      if (input.allowDynamicMarkets !== undefined) data.allowDynamicMarkets = input.allowDynamicMarkets
      if (input.status === MissionStatus.CANCELLED) data.lifecycleError = null
      const updated = await transaction.mission.update({ where: { id }, data, include: { markets: { orderBy: { symbol: 'asc' } }, _count: { select: { entries: true, results: true } } } })
      await writeAdminAudit(transaction, actor, 'MISSION_UPDATED', 'Mission', id, id, {
        previousStatus: current.status,
        status: updated.status,
        changedFields: Object.keys(input),
      })
      return updated
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { data: serializeAdminMission(mission) }
  })

  app.post('/admin/missions/:id/markets', async (request, reply) => {
    const { id } = missionIdSchema.parse(request.params)
    const input = createMarketSchema.parse(request.body)
    const actor = identityFor(request)
    try {
      const market = await prisma.$transaction(async (transaction) => {
        const mission = await transaction.mission.findUnique({ where: { id }, select: { id: true, status: true } })
        if (!mission) throw new AppError('MISSION_NOT_FOUND', 'Mission not found.', 404)
        assertMissionConfigurationOpen(mission.status)
        const created = await transaction.missionMarket.create({ data: { missionId: id, ...input } })
        await writeAdminAudit(transaction, actor, 'MISSION_MARKET_CREATED', 'MissionMarket', created.id, id, { symbol: created.symbol, mintAddress: created.mintAddress, decimals: created.decimals })
        return created
      })
      return reply.code(201).send({ data: market })
    } catch (error: unknown) { handleUniqueConflict(error, 'This market already exists in the mission.') }
  })

  app.patch('/admin/missions/:id/markets/:marketId', async (request) => {
    const { id, marketId } = marketParamsSchema.parse(request.params)
    const input = updateMarketSchema.parse(request.body)
    const actor = identityFor(request)
    const market = await prisma.$transaction(async (transaction) => {
      const mission = await transaction.mission.findUnique({ where: { id }, select: { status: true } })
      if (!mission) throw new AppError('MISSION_NOT_FOUND', 'Mission not found.', 404)
      assertMissionConfigurationOpen(mission.status)
      const current = await transaction.missionMarket.findFirst({ where: { id: marketId, missionId: id } })
      if (!current) throw new AppError('MARKET_NOT_FOUND', 'Market does not belong to this mission.', 404)
      const data: Prisma.MissionMarketUpdateInput = {}
      if (input.symbol !== undefined) data.symbol = input.symbol
      if (input.mintAddress !== undefined) data.mintAddress = input.mintAddress
      if (input.decimals !== undefined) data.decimals = input.decimals
      if (input.enabled !== undefined) data.enabled = input.enabled
      const updated = await transaction.missionMarket.update({ where: { id: marketId }, data })
      await writeAdminAudit(transaction, actor, 'MISSION_MARKET_UPDATED', 'MissionMarket', marketId, id, { symbol: updated.symbol, changedFields: Object.keys(input) })
      return updated
    })
    return { data: market }
  })
}

export function assertAdminStatusTransition(current: MissionStatus, next: MissionStatus) {
  if (current === next) return
  if (([MissionStatus.FINALIZED, MissionStatus.CLOSED, MissionStatus.CANCELLED] as MissionStatus[]).includes(current)) {
    if (current === MissionStatus.FINALIZED && next === MissionStatus.CLOSED) return
    throw new AppError('INVALID_MISSION_TRANSITION', 'Terminal missions cannot be reopened or changed.', 409)
  }
  if (([MissionStatus.ACTIVE, MissionStatus.BLACKOUT, MissionStatus.SETTLING, MissionStatus.FINALIZED] as MissionStatus[]).includes(next)) {
    throw new AppError('INVALID_MISSION_TRANSITION', 'ACTIVE, BLACKOUT, SETTLING, and FINALIZED are managed automatically.', 409)
  }
}


function assertMissionRulesMutable(current: { status: MissionStatus; startingBalance: Prisma.Decimal; startsAt: Date; endsAt: Date; allowDynamicMarkets: boolean }, input: { startingBalance?: number | undefined; startsAt?: Date | undefined; endsAt?: Date | undefined; allowDynamicMarkets?: boolean | undefined }) {
  if (([MissionStatus.DRAFT, MissionStatus.REGISTRATION, MissionStatus.LOCKED] as MissionStatus[]).includes(current.status)) return
  const balanceChanged = input.startingBalance !== undefined && !current.startingBalance.equals(input.startingBalance)
  const startChanged = input.startsAt !== undefined && current.startsAt.getTime() !== input.startsAt.getTime()
  const endChanged = input.endsAt !== undefined && current.endsAt.getTime() !== input.endsAt.getTime()
  const marketModeChanged = input.allowDynamicMarkets !== undefined && current.allowDynamicMarkets !== input.allowDynamicMarkets
  if (balanceChanged || startChanged || endChanged || marketModeChanged) throw new AppError('INVALID_MISSION_TRANSITION', 'Capital, schedule, and market-universe rules are locked once trading begins.', 409)
}

function assertMissionConfigurationOpen(status: MissionStatus) {
  if (!([MissionStatus.DRAFT, MissionStatus.REGISTRATION, MissionStatus.LOCKED] as MissionStatus[]).includes(status)) {
    throw new AppError('INVALID_MISSION_TRANSITION', 'Markets are locked once mission trading begins.', 409)
  }
}

async function writeAdminAudit(transaction: Prisma.TransactionClient, actor: AdminIdentity, action: string, entityType: string, entityId: string, missionId: string | null, metadata: Prisma.InputJsonValue) {
  await transaction.adminAuditLog.create({ data: { actorType: AuditActorType.ADMIN, actorUserId: actor.user.id, actorWallet: actor.walletAddress, action, entityType, entityId, missionId, metadata } })
}

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
function handleUniqueConflict(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('CONFLICT', message, 409)
  throw error
}

function serializeAdminMission(mission: {
  id: string; name: string; slug: string; description: string | null; status: MissionStatus; startingBalance: Prisma.Decimal; startsAt: Date; endsAt: Date; settledAt: Date | null; lifecycleError: string | null; allowDynamicMarkets: boolean
  markets: Array<{ id: string; symbol: string; mintAddress: string; decimals: number; enabled: boolean; settlementPrice: Prisma.Decimal | null; settledAt: Date | null }>
  _count: { entries: number; results: number }
}) {
  return {
    id: mission.id, name: mission.name, slug: mission.slug, description: mission.description, status: mission.status,
    startingBalance: mission.startingBalance.toString(), startsAt: mission.startsAt.toISOString(), endsAt: mission.endsAt.toISOString(),
    settledAt: mission.settledAt?.toISOString() ?? null, lifecycleError: mission.lifecycleError, allowDynamicMarkets: mission.allowDynamicMarkets,
    markets: mission.markets.map((market) => ({ ...market, settlementPrice: market.settlementPrice?.toString() ?? null, settledAt: market.settledAt?.toISOString() ?? null })),
    operatorCount: mission._count.entries, resultCount: mission._count.results,
  }
}
