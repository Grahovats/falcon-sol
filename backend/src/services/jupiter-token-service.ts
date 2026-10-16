import bs58 from 'bs58'
import { z } from 'zod'
import { AppError } from '../errors/app-error.js'

const nullableNumber = z.number().finite().nullable().optional()
const tokenStatsSchema = z.object({
  priceChange: nullableNumber,
  buyVolume: nullableNumber,
  sellVolume: nullableNumber,
  numTraders: nullableNumber,
}).nullish()
const tokenSchema = z.object({
  id: z.string(),
  name: z.string().default('Unknown token'),
  symbol: z.string().default('UNKNOWN'),
  icon: z.string().url().nullish().catch(null),
  decimals: z.number().int().min(0).max(18),
  firstPool: z.object({ createdAt: z.string().nullish() }).nullish(),
  holderCount: nullableNumber,
  audit: z.object({
    mintAuthorityDisabled: z.boolean().nullish(),
    freezeAuthorityDisabled: z.boolean().nullish(),
    topHoldersPercentage: nullableNumber,
  }).nullish(),
  organicScore: nullableNumber,
  organicScoreLabel: z.string().nullish(),
  isVerified: z.boolean().default(false),
  usdPrice: nullableNumber,
  liquidity: nullableNumber,
  stats5m: tokenStatsSchema,
  stats1h: tokenStatsSchema,
  stats24h: tokenStatsSchema,
})

const tokenListSchema = z.array(tokenSchema)

export interface TokenCandidate {
  mintAddress: string
  name: string
  symbol: string
  iconUrl?: string | null
  decimals: number
  usdPrice: number | null
  liquidityUsd: number | null
  holderCount: number | null
  firstPoolAt: string | null
  priceChange5m: number | null
  priceChange1h: number | null
  priceChange24h: number | null
  volume24hUsd: number | null
  organicScore: number | null
  organicScoreLabel: string | null
  isVerified: boolean
  warnings: string[]
  eligible: boolean
  ineligibleReasons: string[]
}

interface JupiterTokenOptions {
  apiKey: string | undefined
  baseUrl: string
  timeoutMs: number
  minLiquidityUsd: number
  fetcher?: typeof fetch
}

export class JupiterTokenService {
  private readonly fetcher: typeof fetch
  private readonly iconCache = new Map<string, { url: string | null; expiresAt: number }>()
  private readonly pendingIcons = new Map<string, Promise<void>>()

  constructor(private readonly options: JupiterTokenOptions) {
    this.fetcher = options.fetcher ?? fetch
  }

  async search(query: string) {
    const normalized = query.trim()
    if (normalized.length < 2) throw new AppError('VALIDATION_ERROR', 'Enter at least two characters or a full mint address.')
    return this.fetchTokens(`/tokens/v2/search?query=${encodeURIComponent(normalized)}`)
  }

  async recent() {
    return this.fetchTokens('/tokens/v2/recent')
  }

  async resolveMint(mintAddress: string) {
    assertSolanaAddress(mintAddress)
    const tokens = await this.fetchTokens(`/tokens/v2/search?query=${encodeURIComponent(mintAddress)}`)
    const token = tokens.find((candidate) => candidate.mintAddress === mintAddress)
    if (!token) throw new AppError('TOKEN_NOT_FOUND', 'Jupiter does not recognize this token mint.', 404)
    return token
  }

  async getIcons(mintAddresses: string[]): Promise<Record<string, string | null>> {
    const mints = [...new Set(mintAddresses)].sort()
    const missing = mints.filter(mint => (this.iconCache.get(mint)?.expiresAt ?? 0) <= Date.now())
    const requests: Promise<void>[] = []
    for (let offset = 0; offset < missing.length; offset += 100) {
      const batch = missing.slice(offset, offset + 100)
      const key = batch.join(',')
      let request = this.pendingIcons.get(key)
      if (!request) {
        request = (async () => {
          let tokens: TokenCandidate[] = []
          let failed = false
          try { tokens = await this.fetchTokens(`/tokens/v2/search?query=${encodeURIComponent(key)}`) }
          catch { failed = true } // Logos must never interrupt trading or trigger retry storms.
          const icons = new Map(tokens.map(token => [token.mintAddress, token.iconUrl ?? null]))
          const expiresAt = Date.now() + (failed ? 60_000 : 86_400_000)
          for (const mint of batch) {
            if (this.iconCache.size >= 2_000) this.iconCache.delete(this.iconCache.keys().next().value!)
            this.iconCache.set(mint, { url: icons.get(mint) ?? null, expiresAt })
          }
        })().finally(() => { this.pendingIcons.delete(key) })
        this.pendingIcons.set(key, request)
      }
      requests.push(request)
    }
    await Promise.all(requests)
    return Object.fromEntries(mints.map(mint => [mint, this.iconCache.get(mint)?.url ?? null]))
  }

  private async fetchTokens(path: string) {
    if (!this.options.apiKey) {
      throw new AppError('MARKET_DATA_CONFIGURATION_ERROR', 'Token discovery requires JUPITER_API_KEY.', 503)
    }
    let response: Response
    try {
      response = await this.fetcher(`${this.options.baseUrl}${path}`, {
        headers: { 'x-api-key': this.options.apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      })
    } catch {
      throw new AppError('TOKEN_DISCOVERY_UNAVAILABLE', 'Jupiter token discovery is temporarily unavailable.', 503)
    }
    if (!response.ok) {
      if (response.status === 429) throw new AppError('TOKEN_DISCOVERY_UNAVAILABLE', 'Jupiter rate limit reached. Retry shortly.', 503)
      throw new AppError('TOKEN_DISCOVERY_UNAVAILABLE', 'Jupiter token discovery is temporarily unavailable.', response.status >= 500 ? 503 : 502)
    }
    try {
      return tokenListSchema.parse(await response.json()).map((token) => this.toCandidate(token))
    } catch {
      throw new AppError('TOKEN_DISCOVERY_UNAVAILABLE', 'Jupiter returned invalid token information.', 503)
    }
  }

  private toCandidate(token: z.infer<typeof tokenSchema>): TokenCandidate {
    const liquidityUsd = token.liquidity ?? null
    const usdPrice = token.usdPrice ?? null
    const ineligibleReasons: string[] = []
    if (usdPrice === null || usdPrice <= 0) ineligibleReasons.push('No reliable USD price')
    if (liquidityUsd === null) ineligibleReasons.push('Liquidity is unknown')
    else if (liquidityUsd < this.options.minLiquidityUsd) ineligibleReasons.push(`Liquidity below $${this.options.minLiquidityUsd.toLocaleString('en-US')}`)

    const warnings: string[] = []
    if (!token.isVerified) warnings.push('Unverified token')
    if (token.audit?.mintAuthorityDisabled === false) warnings.push('Mint authority enabled')
    if (token.audit?.freezeAuthorityDisabled === false) warnings.push('Freeze authority enabled')
    if ((token.audit?.topHoldersPercentage ?? 0) >= 50) warnings.push('Top holders own at least 50%')
    if ((token.organicScore ?? 100) < 25) warnings.push('Low organic activity score')

    const buyVolume = token.stats24h?.buyVolume ?? 0
    const sellVolume = token.stats24h?.sellVolume ?? 0
    return {
      mintAddress: token.id,
      name: token.name,
      symbol: token.symbol.toUpperCase().slice(0, 20),
      iconUrl: token.icon?.startsWith('https://') ? token.icon : null,
      decimals: token.decimals,
      usdPrice,
      liquidityUsd,
      holderCount: token.holderCount ?? null,
      firstPoolAt: token.firstPool?.createdAt ?? null,
      priceChange5m: token.stats5m?.priceChange ?? null,
      priceChange1h: token.stats1h?.priceChange ?? null,
      priceChange24h: token.stats24h?.priceChange ?? null,
      volume24hUsd: buyVolume + sellVolume || null,
      organicScore: token.organicScore ?? null,
      organicScoreLabel: token.organicScoreLabel ?? null,
      isVerified: token.isVerified,
      warnings,
      eligible: ineligibleReasons.length === 0,
      ineligibleReasons,
    }
  }
}

export function assertSolanaAddress(value: string) {
  try {
    if (bs58.decode(value).length !== 32) throw new Error('invalid length')
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Enter a valid Solana mint address.')
  }
}
