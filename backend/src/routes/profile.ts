import { Prisma } from '@prisma/client'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AppError } from '../errors/app-error.js'
import { prisma } from '../lib/prisma.js'
import { getAuthenticatedUser } from '../services/auth-service.js'
import { marketDataService } from '../services/market-data.js'
import { decimal } from '../services/trading-calculations.js'
import { TradingService } from '../services/trading-service.js'

const tradingService = new TradingService(prisma, marketDataService)
const updateProfileSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters.').max(24, 'Username must be 24 characters or fewer.').regex(/^[a-zA-Z0-9_-]+$/, 'Use only letters, numbers, hyphens, and underscores.'),
})

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get('/profile', async (request) => {
    const user = await getAuthenticatedUser(prisma, request)
    const entries = await prisma.missionEntry.findMany({
      where: { userId: user.id },
      include: { mission: { select: { id: true, name: true, startsAt: true, _count: { select: { entries: true } } } } },
      orderBy: { joinedAt: 'desc' },
    })
    const results = await Promise.all(entries.map(async (entry) => {
      const [portfolio, leaderboard] = await Promise.all([
        tradingService.calculatePortfolio(entry.missionId, user.id),
        tradingService.calculateLeaderboard(entry.missionId),
      ])
      const rank = leaderboard.find((row) => row.userId === user.id)?.rank ?? null
      return {
        missionId: entry.missionId,
        missionName: entry.mission.name,
        missionDate: entry.mission.startsAt.toISOString(),
        participantCount: entry.mission._count.entries,
        rank,
        equity: portfolio.totalEquity,
        returnPercent: portfolio.returnPercent,
      }
    }))
    const totalReturn = results.reduce((sum, result) => sum.plus(result.returnPercent), decimal(0))
    const best = [...results].sort((left, right) => decimal(right.returnPercent).comparedTo(left.returnPercent))[0]
    const wallet = await prisma.wallet.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } })

    return {
      data: {
        userId: user.id,
        username: user.username ?? `operator-${(wallet?.address ?? user.id).slice(0, 4).toLowerCase()}`,
        wallet: wallet?.address ?? null,
        memberSince: user.createdAt.toISOString(),
        missionsEntered: results.length,
        bestResult: best ?? null,
        averageReturn: results.length === 0 ? '0' : totalReturn.div(results.length).toString(),
        wins: results.filter((result) => result.rank === 1).length,
        topThreeFinishes: results.filter((result) => result.rank !== null && result.rank <= 3).length,
        results,
      },
    }
  })

  app.patch('/profile', async (request) => {
    const user = await getAuthenticatedUser(prisma, request)
    const { username } = updateProfileSchema.parse(request.body)
    try {
      const updated = await prisma.user.update({ where: { id: user.id }, data: { username }, select: { username: true } })
      return { data: updated }
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('CONFLICT', 'That operator name is already in use.', 409)
      }
      throw error
    }
  })
}
