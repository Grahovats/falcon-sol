import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { getAuthenticatedUser } from '../services/auth-service.js'
import { marketDataService } from '../services/market-data.js'
import { decimal } from '../services/trading-calculations.js'
import { TradingService } from '../services/trading-service.js'

const tradingService = new TradingService(prisma, marketDataService)

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get('/profile', async (request) => {
    const user = await getAuthenticatedUser(prisma, request)
    const entries = await prisma.missionEntry.findMany({ where: { userId: user.id }, include: { mission: { select: { id: true, name: true } } }, orderBy: { joinedAt: 'asc' } })
    const results = await Promise.all(entries.map(async (entry) => {
      const [portfolio, leaderboard] = await Promise.all([
        tradingService.calculatePortfolio(entry.missionId, user.id),
        tradingService.calculateLeaderboard(entry.missionId),
      ])
      const rank = leaderboard.find((row) => row.userId === user.id)?.rank ?? null
      return { missionId: entry.missionId, missionName: entry.mission.name, rank, equity: portfolio.totalEquity, returnPercent: portfolio.returnPercent }
    }))
    const totalReturn = results.reduce((sum, result) => sum.plus(result.returnPercent), decimal(0))
    const best = [...results].sort((left, right) => decimal(right.returnPercent).comparedTo(left.returnPercent))[0]
    const wallet = await prisma.wallet.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } })

    return {
      data: {
        userId: user.id,
        username: user.username ?? `operator-${(wallet?.address ?? user.id).slice(0, 4).toLowerCase()}`,
        wallet: wallet?.address ?? null,
        missionsEntered: results.length,
        bestResult: best ?? null,
        averageReturn: results.length === 0 ? '0' : totalReturn.div(results.length).toString(),
        wins: results.filter((result) => result.rank === 1).length,
        topThreeFinishes: results.filter((result) => result.rank !== null && result.rank <= 3).length,
        results,
      },
    }
  })
}
