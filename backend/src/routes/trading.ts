import { Prisma } from '@prisma/client'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AppError } from '../errors/app-error.js'
import { prisma } from '../lib/prisma.js'
import { getAuthenticatedUser } from '../services/auth-service.js'
import { marketDataService } from '../services/market-data.js'
import { acceptsEntries, deriveMissionStatus, isLeaderboardHidden } from '../services/mission-state-service.js'
import { TradingService } from '../services/trading-service.js'

const paramsSchema = z.object({ missionId: z.string().min(1) })
const decimalValue = z.number().positive().finite()
const orderSchema = z.object({
  marketId: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  notional: decimalValue.optional(),
  quantity: decimalValue.optional(),
}).superRefine((order, context) => {
  if (order.side === 'BUY' && (order.notional === undefined || order.quantity !== undefined)) {
    context.addIssue({ code: 'custom', message: 'BUY orders require notional only.' })
  }
  if (order.side === 'SELL' && (order.notional === undefined) === (order.quantity === undefined)) {
    context.addIssue({ code: 'custom', message: 'SELL orders require either notional or quantity.' })
  }
})

const tradingService = new TradingService(prisma, marketDataService)

export const tradingRoutes: FastifyPluginAsync = async (app) => {
  app.post('/missions/:missionId/join', async (request, reply) => {
    const { missionId } = paramsSchema.parse(request.params)
    const user = await getAuthenticatedUser(prisma, request)

    try {
      const entry = await prisma.$transaction(async (transaction) => {
        const mission = await transaction.mission.findUnique({ where: { id: missionId } })
        if (!mission) throw new AppError('MISSION_NOT_FOUND', 'Mission not found.', 404)
        if (!acceptsEntries(deriveMissionStatus(mission))) {
          throw new AppError('MISSION_NOT_ACTIVE', 'This mission is not accepting deployments.')
        }
        const existing = await transaction.missionEntry.findUnique({
          where: { missionId_userId: { missionId, userId: user.id } },
        })
        if (existing) throw new AppError('ALREADY_JOINED', 'This operator has already deployed into the mission.', 409)

        return transaction.missionEntry.create({
          data: {
            missionId,
            userId: user.id,
            startingBalance: mission.startingBalance,
            cashBalance: mission.startingBalance,
            realizedPnl: 0,
          },
        })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      return reply.code(201).send({ data: serializeEntry(entry) })
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('ALREADY_JOINED', 'This operator has already deployed into the mission.', 409)
      }
      throw error
    }
  })

  app.get('/missions/:missionId/markets', async (request) => {
    const { missionId } = paramsSchema.parse(request.params)
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      select: { markets: { where: { enabled: true }, select: { id: true, symbol: true, mintAddress: true, decimals: true, enabled: true } } },
    })
    if (!mission) throw new AppError('MISSION_NOT_FOUND', 'Mission not found.', 404)
    const prices = await marketDataService.getPrices(mission.markets)
    const data = await Promise.all(prices.map(async (price) => {
      const market = mission.markets.find((candidate) => candidate.id === price.marketId)
      if (!market) throw new AppError('MARKET_NOT_FOUND', 'Quoted market is not part of this mission.', 500)
      return {
        marketId: price.marketId,
        symbol: price.symbol,
        mintAddress: market.mintAddress,
        enabled: market.enabled,
        currentPrice: price.price.toString(),
        changePercent: price.changePercent.toString(),
        asOf: price.asOf.toISOString(),
        source: price.source,
        history: (await marketDataService.getPriceHistory(market)).map((point) => ({
          timestamp: point.timestamp.toISOString(),
          price: point.price.toString(),
        })),
      }
    }))
    return { data }
  })

  app.get('/missions/:missionId/prices', async (request) => {
    const { missionId } = paramsSchema.parse(request.params)
    const mission = await prisma.mission.findUnique({ where: { id: missionId }, select: { id: true } })
    if (!mission) throw new AppError('MISSION_NOT_FOUND', 'Mission not found.', 404)
    const markets = await prisma.missionMarket.findMany({ where: { missionId, enabled: true }, select: { id: true, symbol: true, mintAddress: true, decimals: true } })
    const prices = await marketDataService.getPrices(markets)
    return { data: prices.map((price) => ({ ...price, price: price.price.toString(), changePercent: price.changePercent.toString(), asOf: price.asOf.toISOString() })) }
  })

  app.get('/missions/:missionId/portfolio', async (request) => {
    const { missionId } = paramsSchema.parse(request.params)
    const user = await getAuthenticatedUser(prisma, request)
    return { data: await tradingService.calculatePortfolio(missionId, user.id) }
  })

  app.get('/missions/:missionId/leaderboard', async (request) => {
    const { missionId } = paramsSchema.parse(request.params)
    const mission = await prisma.mission.findUnique({ where: { id: missionId } })
    if (!mission) throw new AppError('MISSION_NOT_FOUND', 'Mission not found.', 404)
    const status = deriveMissionStatus(mission)
    const cancelled = status === 'CANCELLED'
    const hidden = isLeaderboardHidden(status)
    return { data: hidden || cancelled ? [] : await tradingService.calculateLeaderboard(missionId), meta: { hidden, status } }
  })

  app.get('/missions/:missionId/orders', async (request) => {
    const { missionId } = paramsSchema.parse(request.params)
    const user = await getAuthenticatedUser(prisma, request)
    const entry = await prisma.missionEntry.findUnique({ where: { missionId_userId: { missionId, userId: user.id } } })
    if (!entry) throw new AppError('MISSION_ENTRY_NOT_FOUND', 'Deploy into this mission before viewing orders.', 404)
    const orders = await prisma.order.findMany({
      where: { missionEntryId: entry.id },
      include: { missionMarket: { select: { symbol: true } }, fill: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return {
      data: orders.map((order) => ({
        id: order.id,
        timestamp: (order.executedAt ?? order.createdAt).toISOString(),
        marketId: order.missionMarketId,
        symbol: order.missionMarket.symbol,
        side: order.side,
        quantity: order.fill?.quantity.toString() ?? order.requestedQuantity?.toString() ?? null,
        executionPrice: order.fill?.executionPrice.toString() ?? null,
        notional: order.fill?.notional.toString() ?? order.requestedNotional.toString(),
        status: order.status,
        quoteProvider: order.fill?.quoteProvider ?? null,
        quoteRouter: order.fill?.quoteRouter ?? null,
        priceImpactPercent: order.fill?.priceImpactPct?.toString() ?? null,
        simulatedFee: order.fill?.simulatedFee.toString() ?? null,
        referencePrice: order.fill?.referencePrice?.toString() ?? null,
      })),
    }
  })

  app.post('/missions/:missionId/orders', async (request, reply) => {
    const { missionId } = paramsSchema.parse(request.params)
    const order = orderSchema.parse(request.body)
    const user = await getAuthenticatedUser(prisma, request)
    const result = order.side === 'BUY'
      ? await tradingService.placeBuyOrder({ missionId, userId: user.id, marketId: order.marketId, notional: order.notional as number })
      : order.quantity !== undefined
        ? await tradingService.placeSellOrder({ missionId, userId: user.id, marketId: order.marketId, quantity: order.quantity })
        : await tradingService.placeSellOrder({ missionId, userId: user.id, marketId: order.marketId, notional: order.notional as number })
    return reply.code(201).send({ data: result })
  })
}

function serializeEntry(entry: {
  id: string
  missionId: string
  userId: string
  startingBalance: Prisma.Decimal
  cashBalance: Prisma.Decimal
  realizedPnl: Prisma.Decimal
  joinedAt: Date
}) {
  return {
    ...entry,
    startingBalance: entry.startingBalance.toString(),
    cashBalance: entry.cashBalance.toString(),
    realizedPnl: entry.realizedPnl.toString(),
  }
}
