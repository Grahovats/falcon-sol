import { z } from 'zod'
import { AppError } from '../errors/app-error.js'
import type { PriceMarket } from './price-service.js'

export const candleTimeframes = ['5m', '15m', '1h', '4h'] as const
export type CandleTimeframe = (typeof candleTimeframes)[number]

export interface MarketCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface GeckoTerminalOptions {
  baseUrl: string
  timeoutMs: number
  cacheTtlMs: number
  fetcher?: typeof fetch
  clock?: () => number
}

const poolSchema = z.object({
  attributes: z.object({
    address: z.string().min(1),
    volume_usd: z.object({ h24: z.string().nullable().optional() }).passthrough(),
  }),
  relationships: z.object({
    base_token: z.object({ data: z.object({ id: z.string() }) }),
    quote_token: z.object({ data: z.object({ id: z.string() }) }),
  }),
})
const poolsResponseSchema = z.object({ data: z.array(poolSchema).min(1) })
const ohlcvResponseSchema = z.object({
  data: z.object({
    attributes: z.object({
      ohlcv_list: z.array(z.tuple([
        z.number().int().positive(),
        z.number().positive(),
        z.number().positive(),
        z.number().positive(),
        z.number().positive(),
        z.number().nonnegative(),
      ])),
    }),
  }),
})

const timeframeConfig: Record<CandleTimeframe, { unit: 'minute' | 'hour'; aggregate: number }> = {
  '5m': { unit: 'minute', aggregate: 5 },
  '15m': { unit: 'minute', aggregate: 15 },
  '1h': { unit: 'hour', aggregate: 1 },
  '4h': { unit: 'hour', aggregate: 4 },
}

type PoolSelection = { address: string; tokenSide: 'base' | 'quote' }
type CacheEntry<T> = { value: T; expiresAt: number }

export class GeckoTerminalCandleService {
  private readonly fetcher: typeof fetch
  private readonly clock: () => number
  private readonly pools = new Map<string, CacheEntry<PoolSelection>>()
  private readonly candles = new Map<string, CacheEntry<MarketCandle[]>>()
  private readonly pendingCandles = new Map<string, Promise<MarketCandle[]>>()

  constructor(private readonly options: GeckoTerminalOptions) {
    this.fetcher = options.fetcher ?? fetch
    this.clock = options.clock ?? Date.now
  }

  async getCandles(market: PriceMarket, timeframe: CandleTimeframe): Promise<MarketCandle[]> {
    const cacheKey = `${market.mintAddress}:${timeframe}`
    const cached = this.getCached(this.candles, cacheKey)
    if (cached) return cached
    const pending = this.pendingCandles.get(cacheKey)
    if (pending) return pending

    const request = this.loadCandles(market, timeframe, cacheKey)
    this.pendingCandles.set(cacheKey, request)
    try {
      return await request
    } finally {
      this.pendingCandles.delete(cacheKey)
    }
  }

  private async loadCandles(market: PriceMarket, timeframe: CandleTimeframe, cacheKey: string) {
    const pool = await this.getPool(market.mintAddress)
    const config = timeframeConfig[timeframe]
    const query = new URLSearchParams({
      aggregate: String(config.aggregate),
      limit: '120',
      currency: 'usd',
      token: pool.tokenSide,
    })
    const response = ohlcvResponseSchema.parse(await this.requestJson(
      `/networks/solana/pools/${encodeURIComponent(pool.address)}/ohlcv/${config.unit}?${query.toString()}`,
    ))
    const candles = response.data.attributes.ohlcv_list
      .map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
      .sort((left, right) => left.time - right.time)

    if (candles.length === 0) throw new AppError('CANDLE_DATA_UNAVAILABLE', `No candle history is available for ${market.symbol}.`, 503)
    this.candles.set(cacheKey, { value: candles, expiresAt: this.clock() + this.options.cacheTtlMs })
    return candles
  }

  private async getPool(mintAddress: string) {
    const cached = this.getCached(this.pools, mintAddress)
    if (cached) return cached

    const response = poolsResponseSchema.parse(await this.requestJson(
      `/networks/solana/tokens/${encodeURIComponent(mintAddress)}/pools?page=1`,
    ))
    const tokenId = `solana_${mintAddress}`
    const candidates = response.data
      .filter((pool) => pool.relationships.base_token.data.id === tokenId || pool.relationships.quote_token.data.id === tokenId)
      .sort((left, right) => Number(right.attributes.volume_usd.h24 ?? 0) - Number(left.attributes.volume_usd.h24 ?? 0))
    const selected = candidates[0]
    if (!selected) throw new AppError('CANDLE_DATA_UNAVAILABLE', 'No liquid chart market is available for this token.', 503)

    const value: PoolSelection = {
      address: selected.attributes.address,
      tokenSide: selected.relationships.base_token.data.id === tokenId ? 'base' : 'quote',
    }
    this.pools.set(mintAddress, { value, expiresAt: this.clock() + 30 * 60_000 })
    return value
  }

  private getCached<T>(cache: Map<string, CacheEntry<T>>, key: string) {
    const entry = cache.get(key)
    if (!entry) return null
    if (entry.expiresAt <= this.clock()) {
      cache.delete(key)
      return null
    }
    return entry.value
  }

  private async requestJson(path: string): Promise<unknown> {
    let response: Response
    try {
      response = await this.fetcher(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      })
    } catch {
      throw new AppError('CANDLE_DATA_UNAVAILABLE', 'Historical candle data is temporarily unavailable.', 503)
    }
    if (!response.ok) {
      const message = response.status === 429 ? 'Chart data rate limit reached. Retry shortly.' : 'Historical candle data is temporarily unavailable.'
      throw new AppError('CANDLE_DATA_UNAVAILABLE', message, 503)
    }
    try {
      return await response.json()
    } catch {
      throw new AppError('CANDLE_DATA_UNAVAILABLE', 'The chart provider returned an invalid response.', 503)
    }
  }
}
