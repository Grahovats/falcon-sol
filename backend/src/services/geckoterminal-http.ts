import { env } from '../config/env.js'
import { GeckoTerminalClient } from './geckoterminal-client.js'

export const geckoTerminalClient = new GeckoTerminalClient({
  baseUrl: env.GECKOTERMINAL_API_BASE_URL,
  timeoutMs: env.GECKOTERMINAL_REQUEST_TIMEOUT_MS,
})
