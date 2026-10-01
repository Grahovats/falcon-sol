import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AppError } from '../errors/app-error.js'
import { prisma } from '../lib/prisma.js'
import { decimal } from '../services/trading-calculations.js'

const paramsSchema = z.object({ userId: z.string().min(1) })

export const operatorRoutes: FastifyPluginAsync = async (app) => {
  app.get('/operators/:userId', async (request) => {
    const { userId } = paramsSchema.parse(request.params)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        wallets: { orderBy: { createdAt: 'asc' }, take: 1, select: { address: true } },
        results: {
          where: { mission: { status: { in: ['FINALIZED', 'CLOSED'] } } },
          include: { mission: { select: { id: true, name: true } } },
          orderBy: { settledAt: 'desc' },
        },
      },
    })
    if (!user) throw new AppError('OPERATOR_NOT_FOUND', 'Operator not found.', 404)

    const wallet = user.wallets[0]?.address ?? null
    const totalReturn = user.results.reduce((total, result) => total.plus(result.returnPercent), decimal(0))
    const results = user.results.map((result) => ({
      missionId: result.mission.id,
      missionName: result.mission.name,
      rank: result.rank,
      equity: result.equity.toString(),
      returnPercent: result.returnPercent.toString(),
      settledAt: result.settledAt.toISOString(),
    }))
    const bestResult = [...results].sort((left, right) => decimal(right.returnPercent).comparedTo(left.returnPercent))[0] ?? null

    return {
      data: {
        userId: user.id,
        username: user.username ?? (wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : `Operator ${user.id.slice(-6)}`),
        wallet,
        missionsEntered: results.length,
        bestResult,
        averageReturn: results.length === 0 ? '0' : totalReturn.div(results.length).toString(),
        wins: results.filter((result) => result.rank === 1).length,
        topThreeFinishes: results.filter((result) => result.rank <= 3).length,
        results,
      },
    }
  })
}
