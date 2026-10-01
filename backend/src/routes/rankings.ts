import { MissionStatus } from '@prisma/client'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { marketDataService } from '../services/market-data.js'
import { deriveMissionStatus, isLeaderboardHidden } from '../services/mission-state-service.js'
import { buildGlobalRankings } from '../services/ranking-service.js'
import { TradingService } from '../services/trading-service.js'

const tradingService = new TradingService(prisma, marketDataService)

export const rankingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/rankings', async () => {
    const [settledResults, missions] = await Promise.all([
      prisma.missionResult.findMany({
        where: { mission: { status: { in: [MissionStatus.FINALIZED, MissionStatus.CLOSED] } } },
        orderBy: [{ settledAt: 'desc' }, { rank: 'asc' }],
      }),
      prisma.mission.findMany({
        where: { status: { in: [MissionStatus.REGISTRATION, MissionStatus.LOCKED, MissionStatus.ACTIVE, MissionStatus.BLACKOUT, MissionStatus.SETTLING, MissionStatus.FINALIZED, MissionStatus.CLOSED] } },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          startsAt: true,
          endsAt: true,
          _count: { select: { entries: true } },
          results: { orderBy: { rank: 'asc' }, take: 10 },
        },
      }),
    ])

    const overall = buildGlobalRankings(settledResults)
    const liveMissions = await Promise.all(missions
      .filter((mission) => {
        const status = deriveMissionStatus(mission)
        return status === MissionStatus.ACTIVE || status === MissionStatus.BLACKOUT || status === MissionStatus.SETTLING
      })
      .sort((left, right) => left.endsAt.getTime() - right.endsAt.getTime())
      .map(async (mission) => {
        const status = deriveMissionStatus(mission)
        const hidden = isLeaderboardHidden(status)
        return serializeMissionRanking(mission, status, hidden ? [] : await tradingService.calculateLeaderboard(mission.id), hidden)
      }))

    const finalizedMissions = missions
      .filter((mission) => mission.status === MissionStatus.FINALIZED || mission.status === MissionStatus.CLOSED)
      .sort((left, right) => right.endsAt.getTime() - left.endsAt.getTime())
      .map((mission) => serializeMissionRanking(mission, mission.status, mission.results, false))

    return {
      data: { overall, liveMissions, finalizedMissions },
      meta: { finalizedMissionCount: finalizedMissions.length, rankedOperatorCount: overall.length, generatedAt: new Date().toISOString() },
    }
  })
}

interface MissionRecord {
  id: string
  name: string
  slug: string
  status: MissionStatus
  startsAt: Date
  endsAt: Date
  _count: { entries: number }
  results: LeaderboardRow[]
}

interface LeaderboardRow {
  rank: number
  userId: string
  displayName: string
  wallet?: string | null
  walletAddress?: string | null
  equity: { toString(): string } | string
  pnl: { toString(): string } | string
  returnPercent: { toString(): string } | string
}

function serializeMissionRanking(mission: MissionRecord, status: MissionStatus, rows: LeaderboardRow[], hidden: boolean) {
  return {
    id: mission.id,
    name: mission.name,
    slug: mission.slug,
    status,
    startsAt: mission.startsAt.toISOString(),
    endsAt: mission.endsAt.toISOString(),
    operatorCount: mission._count.entries,
    hidden,
    rows: rows.slice(0, 10).map((row) => ({
      rank: row.rank,
      userId: row.userId,
      displayName: row.displayName,
      wallet: row.wallet ?? row.walletAddress ?? null,
      equity: row.equity.toString(),
      pnl: row.pnl.toString(),
      returnPercent: row.returnPercent.toString(),
    })),
  }
}
