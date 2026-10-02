import { env } from '../config/env.js'
import { JupiterTokenService } from './jupiter-token-service.js'

export const tokenDiscoveryService = new JupiterTokenService({
  apiKey: env.JUPITER_API_KEY,
  baseUrl: env.JUPITER_API_BASE_URL.replace(/\/$/, ''),
  timeoutMs: env.JUPITER_REQUEST_TIMEOUT_MS,
  minLiquidityUsd: env.JUPITER_MIN_TOKEN_LIQUIDITY_USD,
})
