import { env } from '../config/env.js'
import { GeckoTerminalCandleService } from './geckoterminal-candle-service.js'
import { geckoTerminalClient } from './geckoterminal-http.js'

export const candleDataService = new GeckoTerminalCandleService({
  baseUrl: env.GECKOTERMINAL_API_BASE_URL,
  timeoutMs: env.GECKOTERMINAL_REQUEST_TIMEOUT_MS,
  cacheTtlMs: env.GECKOTERMINAL_CACHE_TTL_MS,
  requestJson: path => geckoTerminalClient.requestJson(path, 'CANDLE_DATA_UNAVAILABLE'),
})
