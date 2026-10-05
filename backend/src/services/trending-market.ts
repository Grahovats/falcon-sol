import { env } from '../config/env.js'
import { GeckoTerminalTrendingService } from './geckoterminal-trending-service.js'

export const trendingMarketService = new GeckoTerminalTrendingService({
  baseUrl: env.GECKOTERMINAL_API_BASE_URL,
  timeoutMs: env.GECKOTERMINAL_REQUEST_TIMEOUT_MS,
  cacheTtlMs: env.GECKOTERMINAL_CACHE_TTL_MS,
})
