import { env } from '../config/env.js'
import { JupiterMarketDataService } from './jupiter-market-data-service.js'
import { MockMarketDataService } from './mock-market-data-service.js'
import type { MarketDataService } from './price-service.js'

export const marketDataService: MarketDataService = env.MARKET_DATA_PROVIDER === 'jupiter'
  ? new JupiterMarketDataService({
      apiKey: env.JUPITER_API_KEY,
      baseUrl: env.JUPITER_API_BASE_URL.replace(/\/$/, ''),
      usdcMint: env.JUPITER_USDC_MINT,
      timeoutMs: env.JUPITER_REQUEST_TIMEOUT_MS,
      maxPriceImpactPercent: env.JUPITER_MAX_PRICE_IMPACT_PERCENT,
      priceCacheTtlMs: env.JUPITER_PRICE_CACHE_TTL_MS,
      stalePriceMaxAgeMs: env.JUPITER_STALE_PRICE_MAX_AGE_MS,
    })
  : new MockMarketDataService()
