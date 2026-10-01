import 'dotenv/config'
import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  AUTH_DOMAIN: z.string().min(1).default('localhost:5173'),
  AUTH_URI: z.string().url().default('http://localhost:5173'),
  AUTH_CHALLENGE_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  ADMIN_WALLET_ADDRESSES: z.string().default(''),
  MISSION_LIFECYCLE_INTERVAL_MS: z.coerce.number().int().min(1_000).max(300_000).default(5_000),
  MARKET_DATA_PROVIDER: z.enum(['mock', 'jupiter']).default('mock'),
  JUPITER_API_KEY: z.string().trim().optional().transform((value) => value || undefined),
  JUPITER_API_BASE_URL: z.string().url().default('https://api.jup.ag'),
  JUPITER_USDC_MINT: z.string().min(32).default('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  JUPITER_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
  JUPITER_MAX_PRICE_IMPACT_PERCENT: z.coerce.number().positive().max(100).default(5),
  GECKOTERMINAL_API_BASE_URL: z.string().url().default('https://api.geckoterminal.com/api/v2'),
  GECKOTERMINAL_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(8_000),
  GECKOTERMINAL_CACHE_TTL_MS: z.coerce.number().int().min(10_000).max(300_000).default(60_000),
})

const result = environmentSchema.safeParse(process.env)

if (!result.success) {
  console.error('Invalid environment configuration', z.flattenError(result.error).fieldErrors)
  throw new Error('Invalid environment configuration')
}

export const env = result.data
export const corsOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim())

export const adminWalletAddresses = new Set(env.ADMIN_WALLET_ADDRESSES.split(',').map((address) => address.trim()).filter(Boolean))
