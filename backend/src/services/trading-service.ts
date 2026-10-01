import { MissionStatus, OrderSide, OrderStatus, Prisma, type PrismaClient } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'
import { AppError } from '../errors/app-error.js'
import { deriveMissionStatus } from './mission-state-service.js'
import type { ExecutionQuote, MarketDataService } from './price-service.js'
import {
  assertMinimumOrder,
  assertMarketAvailable,
  assertMissionTradingStatus,
  assertPositionLimit,
  assertSufficientBalance,
  assertSufficientPosition,
  calculateBuyPosition,
  calculateEquity,
  calculateMarketValue,
  calculateReturnPercent,
  calculateSellPosition,
  calculateUnrealizedPnl,
  decimal,
  type DecimalInput,
} from './trading-calculations.js'

interface OrderInput {
  missionId: string
  userId: string
  marketId: string
}

interface BuyOrderInput extends OrderInput {
  notional: DecimalInput
}

interface SellOrderInput extends OrderInput {
  notional?: DecimalInput
  quantity?: DecimalInput
}

interface PositionCalculationInput {
  quantity: DecimalInput
  averageEntryPrice: DecimalInput
  currentPrice: DecimalInput
}

const zero = () => decimal(0)

export class TradingService {
  constructor(
    private readonly database: PrismaClient,
    private readonly prices: MarketDataService,
  ) {}

  validateOrder(input: { side?: OrderSide; missionStatus?: MissionStatus; marketEnabled?: boolean; notional?: DecimalInput; quantity?: DecimalInput }) {
    if (input.missionStatus !== undefined) assertMissionTradingStatus(input.missionStatus)
    if (input.marketEnabled !== undefined) assertMarketAvailable(input.marketEnabled)
    if (input.side === undefined) return
    if (input.side === OrderSide.BUY) {
      if (input.notional === undefined || input.quantity !== undefined) throw new AppError('INVALID_ORDER', 'BUY orders require notional only.')
      assertMinimumOrder(input.notional)
      return
    }
    if ((input.notional === undefined) === (input.quantity === undefined)) throw new AppError('INVALID_ORDER', 'SELL orders require either notional or quantity.')
    const requested = decimal(input.quantity ?? input.notional as DecimalInput)
    if (!requested.isPositive()) throw new AppError('INVALID_ORDER', 'Sell amount must be greater than zero.')
  }

  async placeBuyOrder(input: BuyOrderInput) {
    const notional = decimal(input.notional)
    this.validateOrder({ side: OrderSide.BUY, notional })
    const quoteContext = await this.getTradingContext(this.database, input)
    const quote = await this.prices.getBuyQuote(quoteContext.market, notional)

    const execution = await this.database.$transaction(async (transaction) => {
      const context = await this.getTradingContext(transaction, input)
      assertQuoteUsable(quote, context.market, OrderSide.BUY)
      const price = quote.executionPrice
      const position = await transaction.position.findUnique({
        where: { missionEntryId_missionMarketId: { missionEntryId: context.entry.id, missionMarketId: context.market.id } },
      })
      const currentQuantity = position?.quantity ?? zero()

      assertSufficientBalance(context.entry.cashBalance, quote.notional)
      assertPositionLimit(context.entry.startingBalance, currentQuantity, quote.referencePrice, quote.notional)

      const quantity = quote.quantity
      const updatedPosition = calculateBuyPosition(currentQuantity, position?.averageEntryPrice ?? 0, quantity, price)
      const order = await transaction.order.create({
        data: {
          missionEntryId: context.entry.id,
          missionMarketId: context.market.id,
          side: OrderSide.BUY,
          requestedNotional: notional,
          requestedQuantity: quantity,
        },
      })
      const fill = await transaction.fill.create({
        data: { orderId: order.id, executionPrice: price, quantity, notional: quote.notional, simulatedFee: quote.simulatedFee, ...quoteMetadata(quote) },
      })

      await transaction.missionEntry.update({
        where: { id: context.entry.id },
        data: { cashBalance: context.entry.cashBalance.minus(quote.notional) },
      })
      await transaction.position.upsert({
        where: { missionEntryId_missionMarketId: { missionEntryId: context.entry.id, missionMarketId: context.market.id } },
        create: {
          missionEntryId: context.entry.id,
          missionMarketId: context.market.id,
          quantity,
          averageEntryPrice: updatedPosition.averageEntryPrice,
          realizedPnl: 0,
        },
        update: { quantity: updatedPosition.quantity, averageEntryPrice: updatedPosition.averageEntryPrice },
      })
      const filledOrder = await transaction.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.FILLED, executedAt: new Date() },
      })
      return { order: filledOrder, fill }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return { ...serializeExecution(execution), portfolio: await this.calculatePortfolio(input.missionId, input.userId) }
  }

  async placeSellOrder(input: SellOrderInput) {
    this.validateOrder({ side: OrderSide.SELL, ...(input.notional === undefined ? {} : { notional: input.notional }), ...(input.quantity === undefined ? {} : { quantity: input.quantity }) })
    const quoteContext = await this.getTradingContext(this.database, input)
    const referencePrice = input.quantity === undefined ? (await this.prices.getPrice(quoteContext.market)).price : null
    const requestedQuantity = input.quantity === undefined ? decimal(input.notional as DecimalInput).div(referencePrice as Decimal) : decimal(input.quantity)
    const quote = await this.prices.getSellQuote(quoteContext.market, requestedQuantity)

    const execution = await this.database.$transaction(async (transaction) => {
      const context = await this.getTradingContext(transaction, input)
      assertQuoteUsable(quote, context.market, OrderSide.SELL)
      const position = await transaction.position.findUnique({
        where: { missionEntryId_missionMarketId: { missionEntryId: context.entry.id, missionMarketId: context.market.id } },
      })
      if (!position || !position.quantity.isPositive()) {
        throw new AppError('INSUFFICIENT_POSITION', 'No open position is available to sell.')
      }

      const { quantity, notional, executionPrice: price } = quote
      assertSufficientPosition(position.quantity, quantity)
      const updatedPosition = calculateSellPosition(position.quantity, position.averageEntryPrice, position.realizedPnl, quantity, price)
      const order = await transaction.order.create({
        data: {
          missionEntryId: context.entry.id,
          missionMarketId: context.market.id,
          side: OrderSide.SELL,
          requestedNotional: notional,
          requestedQuantity: quantity,
        },
      })
      const fill = await transaction.fill.create({
        data: { orderId: order.id, executionPrice: price, quantity, notional, simulatedFee: quote.simulatedFee, ...quoteMetadata(quote) },
      })

      await transaction.missionEntry.update({
        where: { id: context.entry.id },
        data: {
          cashBalance: context.entry.cashBalance.plus(notional),
          realizedPnl: context.entry.realizedPnl.plus(updatedPosition.realizedPnlDelta),
        },
      })
      await transaction.position.update({
        where: { id: position.id },
        data: {
          quantity: updatedPosition.quantity,
          averageEntryPrice: updatedPosition.averageEntryPrice,
          realizedPnl: updatedPosition.realizedPnl,
        },
      })
      const filledOrder = await transaction.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.FILLED, executedAt: new Date() },
      })
      return { order: filledOrder, fill }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return { ...serializeExecution(execution), portfolio: await this.calculatePortfolio(input.missionId, input.userId) }
  }

  calculatePositionMetrics(input: PositionCalculationInput) {
    const quantity = decimal(input.quantity)
    const currentPrice = decimal(input.currentPrice)
    const averageEntryPrice = decimal(input.averageEntryPrice)
    const marketValue = calculateMarketValue(quantity, currentPrice)
    const unrealizedPnl = calculateUnrealizedPnl(quantity, currentPrice, averageEntryPrice)
    const costBasis = quantity.mul(averageEntryPrice)
    const unrealizedPnlPercent = costBasis.isZero() ? zero() : unrealizedPnl.div(costBasis).mul(100)
    return { marketValue, unrealizedPnl, unrealizedPnlPercent }
  }

  async calculatePortfolio(missionId: string, userId: string) {
    const entry = await this.database.missionEntry.findUnique({
      where: { missionId_userId: { missionId, userId } },
      include: { mission: { select: { status: true } }, positions: { include: { missionMarket: true } } },
    })
    if (!entry) throw new AppError('MISSION_ENTRY_NOT_FOUND', 'Deploy into this mission before trading.', 404)

    const openPositions = entry.positions.filter((position) => position.quantity.isPositive())
    const settled = entry.mission.status === MissionStatus.FINALIZED || entry.mission.status === MissionStatus.CLOSED
    const pricesByMarket = settled
      ? new Map(openPositions.map((position) => {
          if (!position.missionMarket.settlementPrice) throw new AppError('MISSION_SETTLEMENT_FAILED', `Final price is missing for ${position.missionMarket.symbol}.`, 503)
          return [position.missionMarketId, position.missionMarket.settlementPrice] as const
        }))
      : new Map((await this.prices.getPrices(openPositions.map((position) => position.missionMarket))).map((price) => [price.marketId, price.price]))
    const positionMetrics = openPositions.map((position) => {
      const currentPrice = pricesByMarket.get(position.missionMarketId)
      if (!currentPrice) throw new AppError('MARKET_NOT_AVAILABLE', `No price is available for ${position.missionMarket.symbol}.`)
      const calculated = this.calculatePositionMetrics({
        quantity: position.quantity,
        averageEntryPrice: position.averageEntryPrice,
        currentPrice,
      })
      return {
        marketId: position.missionMarketId,
        symbol: position.missionMarket.symbol,
        quantity: position.quantity.toString(),
        averageEntryPrice: position.averageEntryPrice.toString(),
        currentPrice: currentPrice.toString(),
        marketValue: calculated.marketValue.toString(),
        realizedPnl: position.realizedPnl.toString(),
        unrealizedPnl: calculated.unrealizedPnl.toString(),
        unrealizedPnlPercent: calculated.unrealizedPnlPercent.toString(),
      }
    })
    const totalEquity = calculateEquity(entry.cashBalance, positionMetrics.map((position) => position.marketValue))
    const unrealizedPnl = positionMetrics.reduce<Decimal>((total, position) => total.plus(position.unrealizedPnl), zero())
    const positions = positionMetrics.map((position) => ({
      ...position,
      allocationPercent: totalEquity.isZero() ? '0' : decimal(position.marketValue).div(totalEquity).mul(100).toString(),
    }))

    return {
      entryId: entry.id,
      userId: entry.userId,
      startingBalance: entry.startingBalance.toString(),
      cashBalance: entry.cashBalance.toString(),
      realizedPnl: entry.realizedPnl.toString(),
      unrealizedPnl: unrealizedPnl.toString(),
      totalEquity: totalEquity.toString(),
      totalPnl: totalEquity.minus(entry.startingBalance).toString(),
      returnPercent: calculateReturnPercent(totalEquity, entry.startingBalance).toString(),
      positions,
    }
  }

  async calculateLeaderboard(missionId: string) {
    const mission = await this.database.mission.findUnique({
      where: { id: missionId },
      select: { status: true, results: { orderBy: { rank: 'asc' } } },
    })
    if (mission && (mission.status === MissionStatus.FINALIZED || mission.status === MissionStatus.CLOSED)) {
      return mission.results.map((result) => ({
        rank: result.rank,
        userId: result.userId,
        displayName: result.displayName,
        wallet: result.walletAddress,
        equity: result.equity.toString(),
        pnl: result.pnl.toString(),
        returnPercent: result.returnPercent.toString(),
      }))
    }
    const entries = await this.database.missionEntry.findMany({
      where: { missionId },
      include: { user: { include: { wallets: { take: 1, orderBy: { createdAt: 'asc' } } } } },
    })
    const rows = await Promise.all(entries.map(async (entry) => {
      const portfolio = await this.calculatePortfolio(missionId, entry.userId)
      const wallet = entry.user.wallets[0]?.address
      const displayName = entry.user.username ?? (wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : `Operator ${entry.userId.slice(-6)}`)
      return {
        userId: entry.userId,
        displayName,
        wallet: wallet ?? null,
        equity: portfolio.totalEquity,
        pnl: portfolio.totalPnl,
        returnPercent: portfolio.returnPercent,
        joinedAt: entry.joinedAt,
      }
    }))

    return rows
      .sort((left, right) => {
        const equityComparison = decimal(right.equity).comparedTo(left.equity)
        return equityComparison === 0 ? left.joinedAt.getTime() - right.joinedAt.getTime() : equityComparison
      })
      .map((row, index) => ({
        rank: index + 1,
        userId: row.userId,
        displayName: row.displayName,
        wallet: row.wallet,
        equity: row.equity,
        pnl: row.pnl,
        returnPercent: row.returnPercent,
      }))
  }

  private async getTradingContext(database: Prisma.TransactionClient | PrismaClient, input: OrderInput) {
    const mission = await database.mission.findUnique({ where: { id: input.missionId } })
    if (!mission) throw new AppError('MISSION_NOT_FOUND', 'Mission not found.', 404)
    const missionStatus = deriveMissionStatus(mission)

    const entry = await database.missionEntry.findUnique({
      where: { missionId_userId: { missionId: input.missionId, userId: input.userId } },
    })
    if (!entry) throw new AppError('MISSION_ENTRY_NOT_FOUND', 'Deploy into this mission before trading.', 404)

    const market = await database.missionMarket.findFirst({ where: { id: input.marketId, missionId: input.missionId } })
    if (!market) throw new AppError('MARKET_NOT_FOUND', 'Market does not belong to this mission.', 404)
    this.validateOrder({ missionStatus, marketEnabled: market.enabled })
    return { mission, entry, market }
  }
}

function serializeExecution(execution: {
  order: { id: string; side: OrderSide; status: OrderStatus; requestedNotional: Decimal; requestedQuantity: Decimal | null; createdAt: Date; executedAt: Date | null }
  fill: { id: string; executionPrice: Decimal; referencePrice: Decimal | null; quantity: Decimal; notional: Decimal; simulatedFee: Decimal; priceImpactPct: Decimal | null; quoteProvider: string; quoteRequestId: string | null; quoteId: string | null; quoteRouter: string | null; createdAt: Date }
}) {
  return {
    order: {
      ...execution.order,
      requestedNotional: execution.order.requestedNotional.toString(),
      requestedQuantity: execution.order.requestedQuantity?.toString() ?? null,
    },
    fill: {
      ...execution.fill,
      executionPrice: execution.fill.executionPrice.toString(),
      quantity: execution.fill.quantity.toString(),
      notional: execution.fill.notional.toString(),
      simulatedFee: execution.fill.simulatedFee.toString(),
      referencePrice: execution.fill.referencePrice?.toString() ?? null,
      priceImpactPercent: execution.fill.priceImpactPct?.toString() ?? null,
      quoteProvider: execution.fill.quoteProvider,
      quoteRequestId: execution.fill.quoteRequestId,
      quoteId: execution.fill.quoteId,
      quoteRouter: execution.fill.quoteRouter,
    },
  }
}

function assertQuoteUsable(quote: ExecutionQuote, market: { mintAddress: string }, side: OrderSide) {
  const quotedMarketMint = side === OrderSide.BUY ? quote.outputMint : quote.inputMint
  const expired = quote.expiresAt !== null && quote.expiresAt.getTime() <= Date.now()
  const stale = Date.now() - quote.quotedAt.getTime() > 10_000
  if (quotedMarketMint !== market.mintAddress || expired || stale) {
    throw new AppError('QUOTE_UNAVAILABLE', 'The execution quote expired or the market changed. Retry the order.', 409)
  }
}

function quoteMetadata(quote: ExecutionQuote) {
  return {
    referencePrice: quote.referencePrice,
    priceImpactPct: quote.priceImpactPercent,
    quoteProvider: quote.provider,
    quoteRequestId: quote.requestId,
    quoteId: quote.quoteId,
    quoteRouter: quote.router,
    inputMint: quote.inputMint,
    outputMint: quote.outputMint,
    inputAmount: quote.inputAmount,
    outputAmount: quote.outputAmount,
    routePlan: quote.routePlan as Prisma.InputJsonValue,
    quotedAt: quote.quotedAt,
    quoteExpiresAt: quote.expiresAt,
  }
}
