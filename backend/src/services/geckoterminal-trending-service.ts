import { z } from 'zod'
import { AppError } from '../errors/app-error.js'

const poolSchema = z.object({
  attributes: z.object({
    base_token_price_usd: z.string().nullable().optional(),
    price_change_percentage: z.object({ h24: z.string().nullable().optional() }).passthrough(),
  }),
  relationships: z.object({ base_token: z.object({ data: z.object({ id: z.string() }) }) }),
})

const tokenSchema = z.object({
  id: z.string(),
  type: z.literal('token'),
  attributes: z.object({
    address: z.string().min(1),
    name: z.string().default('Unknown token'),
    symbol: z.string().min(1),
  }).passthrough(),
})

const responseSchema = z.object({
  data: z.array(poolSchema),
  included: z.array(tokenSchema).default([]),
})

const excludedSymbols = new Set(['SOL', 'WSOL', 'USDC', 'USDT', 'USDG', 'PYUSD', 'JUP', 'JITOSOL', 'MSOL', 'BSOL', 'RAY'])
const recognizedMemeSymbols = new Set(['BONK', 'WIF', 'POPCAT', 'PENGU', 'PNUT', 'MEW', 'FARTCOIN', 'GOAT', 'DOGE', 'PEPE', 'SHIB', 'MOODENG', 'GIGA', 'BOME', 'SLERF', 'MYRO', 'PONKE', 'MICHI'])
const memeNamePattern = /\b(cat|dog|doge|pepe|bonk|meme|pengu|goat|frog|wojak|shib|monkey|ape|wif|moon)\b/i

export interface TrendingMemeMarket {
  marketId: string
  symbol: string
  name: string
  mintAddress: string
  currentPrice: string
  changePercent: string
  asOf: string
  source: 'geckoterminal'
}

interface TrendingServiceOptions {
  baseUrl: string
  timeoutMs: number
  cacheTtlMs: number
  fetcher?: typeof fetch
  clock?: () => number
}

export class GeckoTerminalTrendingService {
  private readonly fetcher: typeof fetch
  private readonly clock: () => number
  private cached: { data: TrendingMemeMarket[]; expiresAt: number } | null = null
  private pending: Promise<TrendingMemeMarket[]> | null = null

  constructor(private readonly options: TrendingServiceOptions) {
    this.fetcher = options.fetcher ?? fetch
    this.clock = options.clock ?? Date.now
  }

  async getTrending(limit = 10) {
    if (this.cached && this.cached.expiresAt > this.clock()) return this.cached.data.slice(0, limit)
    if (this.pending) return (await this.pending).slice(0, limit)

    this.pending = this.loadTrending(Math.max(limit, 10))
    try {
      const data = await this.pending
      this.cached = { data, expiresAt: this.clock() + this.options.cacheTtlMs }
      return data.slice(0, limit)
    } catch (error: unknown) {
      if (this.cached?.data.length) return this.cached.data.slice(0, limit)
      throw error
    } finally {
      this.pending = null
    }
  }

  private async loadTrending(limit: number) {
    const query = new URLSearchParams({ include: 'base_token', page: '1', duration: '24h' })
    const response = responseSchema.parse(await this.requestJson(`/networks/solana/trending_pools?${query.toString()}`))
    const tokens = new Map(response.included.map((token) => [token.id, token]))
    const seen = new Set<string>()
    const markets: TrendingMemeMarket[] = []

    for (const pool of response.data) {
      const token = tokens.get(pool.relationships.base_token.data.id)
      if (!token) continue
      const symbol = token.attributes.symbol.trim().toUpperCase().slice(0, 20)
      const price = Number(pool.attributes.base_token_price_usd)
      const change = Number(pool.attributes.price_change_percentage.h24 ?? 0)
      if (!symbol || excludedSymbols.has(symbol) || !isMemeCandidate(token.attributes.address, token.attributes.name, symbol) || !Number.isFinite(price) || price <= 0 || seen.has(token.attributes.address)) continue
      seen.add(token.attributes.address)
      markets.push({
        marketId: token.attributes.address,
        symbol,
        name: token.attributes.name,
        mintAddress: token.attributes.address,
        currentPrice: String(price),
        changePercent: String(Number.isFinite(change) ? change : 0),
        asOf: new Date(this.clock()).toISOString(),
        source: 'geckoterminal',
      })
      if (markets.length >= limit) break
    }

    if (markets.length === 0) throw new AppError('TRENDING_MARKETS_UNAVAILABLE', 'No trending meme markets are available right now.', 503)
    return markets
  }

  private async requestJson(path: string): Promise<unknown> {
    let response: Response
    try {
      response = await this.fetcher(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      })
    } catch {
      throw new AppError('TRENDING_MARKETS_UNAVAILABLE', 'Trending meme markets are temporarily unavailable.', 503)
    }
    if (!response.ok) throw new AppError('TRENDING_MARKETS_UNAVAILABLE', 'Trending meme markets are temporarily unavailable.', 503)
    try {
      return await response.json()
    } catch {
      throw new AppError('TRENDING_MARKETS_UNAVAILABLE', 'The trending-market provider returned invalid data.', 503)
    }
  }
}

function isMemeCandidate(mintAddress: string, name: string, symbol: string) {
  return mintAddress.toLowerCase().endsWith('pump') || recognizedMemeSymbols.has(symbol) || memeNamePattern.test(`${name} ${symbol}`)
}
