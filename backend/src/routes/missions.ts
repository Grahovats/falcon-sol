import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AppError } from '../errors/app-error.js'
import { prisma } from '../lib/prisma.js'
import { deriveMissionStatus } from '../services/mission-state-service.js'

const paramsSchema = z.object({ id: z.string().min(1) })
const missionSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  startingBalance: true,
  startsAt: true,
  endsAt: true,
  allowDynamicMarkets: true,
  markets: {
    where: { enabled: true },
    select: { id: true, symbol: true, mintAddress: true, decimals: true, enabled: true },
    orderBy: { symbol: 'asc' as const },
  },
  _count: { select: { markets: { where: { enabled: true } }, entries: true } },
} as const

function findMission(id: string) {
  return prisma.mission.findUnique({ where: { id }, select: missionSelect })
}

type MissionRecord = NonNullable<Awaited<ReturnType<typeof findMission>>>

function serializeMission(mission: MissionRecord) {
  return {
    id: mission.id,
    name: mission.name,
    slug: mission.slug,
    description: mission.description,
    status: deriveMissionStatus(mission),
    startingBalance: mission.startingBalance.toString(),
    startsAt: mission.startsAt.toISOString(),
    endsAt: mission.endsAt.toISOString(),
    allowDynamicMarkets: mission.allowDynamicMarkets,
    marketCount: mission._count.markets,
    operatorCount: mission._count.entries,
    markets: mission.markets,
  }
}

export const missionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/missions', async () => {
    const missions = await prisma.mission.findMany({
      select: missionSelect,
      orderBy: { startsAt: 'asc' },
    })
    return { data: missions.map(serializeMission) }
  })

  app.get('/missions/:id', async (request) => {
    const { id } = paramsSchema.parse(request.params)
    const mission = await findMission(id)
    if (!mission) throw new AppError('MISSION_NOT_FOUND', 'Mission not found.', 404)
    return { data: serializeMission(mission) }
  })
}
