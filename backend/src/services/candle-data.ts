import { env } from '../config/env.js'
import { GeckoTerminalCandleService } from './geckoterminal-candle-service.js'

export const candleDataService = new GeckoTerminalCandleService({
  baseUrl: env.GECKOTERMINAL_API_BASE_URL,
  timeoutMs: env.GECKOTERMINAL_REQUEST_TIMEOUT_MS,
  cacheTtlMs: env.GECKOTERMINAL_CACHE_TTL_MS,
})
