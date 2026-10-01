import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../errors/app-error.js'
import type { ExecutionQuote, MarketDataService, MarketPrice, PriceMarket, PricePoint } from './price-service.js'
import { atomicToDecimal, decimalToAtomic } from './token-amount.js'

const priceEntrySchema = z.object({
  usdPrice: z.number().positive(),
  blockId: z.number().int(),
  decimals: z.number().int().min(0),
  priceChange24h: z.number().default(0),
})
const priceResponseSchema = z.record(z.string(), priceEntrySchema)
const orderResponseSchema = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  inAmount: z.string().regex(/^\d+$/),
  outAmount: z.string().regex(/^\d+$/),
  priceImpact: z.coerce.number(),
  routePlan: z.array(z.unknown()).default([]),
  feeBps: z.coerce.number().int().nonnegative().default(0),
  router: z.string(),
  requestId: z.string(),
  quoteId: z.string().nullish(),
  expireAt: z.string().nullish(),
})

interface JupiterOptions {
  apiKey: string | undefined
  baseUrl: string
  usdcMint: string
  timeoutMs: number
  maxPriceImpactPercent: number
  priceCacheTtlMs: number
  stalePriceMaxAgeMs: number
  fetcher?: typeof fetch
  clock?: () => Date
}

interface CachedSpot {
  price: Prisma.Decimal
  changePercent: Prisma.Decimal
  asOf: Date
  fetchedAt: number
}

export class JupiterMarketDataService implements MarketDataService {
  private readonly fetcher: typeof fetch
  private readonly clock: () => Date
  private readonly history = new Map<string, PricePoint[]>()
  private readonly priceCache = new Map<string, CachedSpot>()
  private readonly pendingPrices = new Map<string, Promise<CachedSpot>>()

  constructor(private readonly options: JupiterOptions) {
    this.fetcher = options.fetcher ?? fetch
    this.clock = options.clock ?? (() => new Date())
  }

  async getPrice(market: PriceMarket): Promise<MarketPrice> {
    const [price] = await this.getPrices([market])
    if (!price) throw new AppError('MARKET_DATA_UNAVAILABLE', `Jupiter returned no reliable price for ${market.symbol}.`, 503)
    return price
  }

  async getPrices(markets: PriceMarket[]): Promise<MarketPrice[]> {
    if (markets.length === 0) return []
    const uniqueMarkets = [...new Map(markets.map((market) => [market.mintAddress, market])).values()]
    const missing = uniqueMarkets.filter((market) => !this.getFreshSpot(market.mintAddress) && !this.pendingPrices.has(market.mintAddress))

    if (missing.length > 0) {
      const batch = this.fetchPriceBatch(missing)
      for (const market of missing) {
        const request = batch.then((spots) => {
          const spot = spots.get(market.mintAddress)
          if (!spot) throw new AppError('MARKET_DATA_UNAVAILABLE', `Jupiter returned no reliable price for ${market.symbol}.`, 503)
          return spot
        })
        this.pendingPrices.set(market.mintAddress, request)
        const cleanup = () => { if (this.pendingPrices.get(market.mintAddress) === request) this.pendingPrices.delete(market.mintAddress) }
        void request.then(cleanup, cleanup)
      }
    }

    const spots = new Map(await Promise.all(uniqueMarkets.map(async (market) => {
      const cached = this.getFreshSpot(market.mintAddress)
      const spot = cached ?? await this.pendingPrices.get(market.mintAddress)
      if (!spot) throw new AppError('MARKET_DATA_UNAVAILABLE', `Jupiter returned no reliable price for ${market.symbol}.`, 503)
      return [market.mintAddress, spot] as const
    })))

    return markets.map((market) => {
      const spot = spots.get(market.mintAddress)
      if (!spot) throw new AppError('MARKET_DATA_UNAVAILABLE', `Jupiter returned no reliable price for ${market.symbol}.`, 503)
      this.recordPrice(market.id, { timestamp: spot.asOf, price: spot.price })
      return { marketId: market.id, symbol: market.symbol, price: spot.price, changePercent: spot.changePercent, asOf: spot.asOf, source: 'jupiter' as const }
    })
  }

  async getPriceHistory(market: PriceMarket, points = 40): Promise<PricePoint[]> {
    const existing = this.history.get(market.id)
    if (existing?.length) return existing.slice(-points)
    const price = await this.getPrice(market)
    return [{ timestamp: price.asOf, price: price.price }]
  }

  async getBuyQuote(market: PriceMarket, notional: Prisma.Decimal): Promise<ExecutionQuote> {
    return this.getExecutionQuote(market, 'BUY', decimalToAtomic(notional, 6))
  }

  async getSellQuote(market: PriceMarket, quantity: Prisma.Decimal): Promise<ExecutionQuote> {
    return this.getExecutionQuote(market, 'SELL', decimalToAtomic(quantity, market.decimals))
  }

  private async getExecutionQuote(market: PriceMarket, side: 'BUY' | 'SELL', amount: string): Promise<ExecutionQuote> {
    if (new Prisma.Decimal(amount).isZero()) throw new AppError('QUOTE_UNAVAILABLE', 'The order is smaller than one token atomic unit.')
    const inputMint = side === 'BUY' ? this.options.usdcMint : market.mintAddress
    const outputMint = side === 'BUY' ? market.mintAddress : this.options.usdcMint
    const query = new URLSearchParams({ inputMint, outputMint, amount })
    const response = orderResponseSchema.parse(await this.requestJson(`/swap/v2/order?${query.toString()}`))
    if (response.inputMint !== inputMint || response.outputMint !== outputMint || response.inAmount !== amount) {
      throw new AppError('QUOTE_UNAVAILABLE', 'Jupiter returned a quote that does not match the requested market or amount.', 502)
    }

    const quotedAt = this.clock()
    const priceImpactPercent = new Prisma.Decimal(response.priceImpact).abs()
    if (priceImpactPercent.greaterThan(this.options.maxPriceImpactPercent)) {
      throw new AppError(
        'PRICE_IMPACT_TOO_HIGH',
        `Order blocked: Jupiter estimates ${priceImpactPercent.toFixed(2)}% price impact; the limit is ${this.options.maxPriceImpactPercent}%.`,
        422,
      )
    }

    const quantity = side === 'BUY'
      ? atomicToDecimal(response.outAmount, market.decimals)
      : atomicToDecimal(response.inAmount, market.decimals)
    const notional = side === 'BUY'
      ? atomicToDecimal(response.inAmount, 6)
      : atomicToDecimal(response.outAmount, 6)
    if (!quantity.isPositive() || !notional.isPositive()) throw new AppError('QUOTE_UNAVAILABLE', 'Jupiter returned an empty execution quote.', 502)

    const executionPrice = notional.div(quantity)
    const impactRatio = priceImpactPercent.div(100)
    const referencePrice = side === 'BUY'
      ? executionPrice.mul(Prisma.Decimal.max(new Prisma.Decimal(0), new Prisma.Decimal(1).minus(impactRatio)))
      : impactRatio.greaterThanOrEqualTo(1) ? executionPrice : executionPrice.div(new Prisma.Decimal(1).minus(impactRatio))

    return {
      provider: 'jupiter',
      requestId: response.requestId,
      quoteId: response.quoteId ?? null,
      router: response.router,
      inputMint,
      outputMint,
      inputAmount: response.inAmount,
      outputAmount: response.outAmount,
      quantity,
      notional,
      executionPrice,
      referencePrice,
      priceImpactPercent,
      simulatedFee: notional.mul(response.feeBps).div(10_000),
      routePlan: response.routePlan,
      quotedAt,
      expiresAt: parseOptionalDate(response.expireAt),
    }
  }

  private getFreshSpot(mintAddress: string) {
    const cached = this.priceCache.get(mintAddress)
    if (!cached || this.clock().getTime() - cached.fetchedAt > this.options.priceCacheTtlMs) return null
    return cached
  }

  private async fetchPriceBatch(markets: PriceMarket[]) {
    try {
      const ids = markets.map((market) => market.mintAddress)
      const response = priceResponseSchema.parse(await this.requestJson(`/price/v3?ids=${encodeURIComponent(ids.join(','))}`))
      const asOf = this.clock()
      const spots = new Map<string, CachedSpot>()
      for (const market of markets) {
        const result = response[market.mintAddress]
        if (!result) throw new AppError('MARKET_DATA_UNAVAILABLE', `Jupiter returned no reliable price for ${market.symbol}.`, 503)
        const spot = { price: new Prisma.Decimal(result.usdPrice), changePercent: new Prisma.Decimal(result.priceChange24h), asOf, fetchedAt: asOf.getTime() }
        this.priceCache.set(market.mintAddress, spot)
        spots.set(market.mintAddress, spot)
      }
      return spots
    } catch (error: unknown) {
      const now = this.clock().getTime()
      const stale = new Map<string, CachedSpot>()
      for (const market of markets) {
        const cached = this.priceCache.get(market.mintAddress)
        if (!cached || now - cached.fetchedAt > this.options.stalePriceMaxAgeMs) throw error
        stale.set(market.mintAddress, cached)
      }
      return stale
    }
  }

  private recordPrice(marketId: string, point: PricePoint) {
    const current = this.history.get(marketId) ?? []
    const previous = current.at(-1)
    if (!previous || previous.price.comparedTo(point.price) !== 0 || previous.timestamp.getTime() !== point.timestamp.getTime()) current.push(point)
    this.history.set(marketId, current.slice(-40))
  }

  private async requestJson(path: string): Promise<unknown> {
    if (!this.options.apiKey) {
      throw new AppError('MARKET_DATA_CONFIGURATION_ERROR', 'Jupiter live market data requires JUPITER_API_KEY.', 503)
    }
    let response: Response
    try {
      response = await this.fetcher(`${this.options.baseUrl}${path}`, {
        headers: { 'x-api-key': this.options.apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      })
    } catch {
      throw new AppError('MARKET_DATA_UNAVAILABLE', 'Jupiter market data is temporarily unavailable.', 503)
    }
    if (!response.ok) {
      const message = response.status === 429
        ? 'Jupiter rate limit reached. Retry shortly.'
        : response.status >= 500
          ? 'Jupiter market data is temporarily unavailable.'
          : 'Jupiter could not quote this market.'
      throw new AppError(response.status >= 500 || response.status === 429 ? 'MARKET_DATA_UNAVAILABLE' : 'QUOTE_UNAVAILABLE', message, response.status >= 500 || response.status === 429 ? 503 : 422)
    }
    try {
      return await response.json()
    } catch {
      throw new AppError('MARKET_DATA_UNAVAILABLE', 'Jupiter returned an invalid response.', 503)
    }
  }
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
