import { buildApp } from './app.js'
import { env } from './config/env.js'

// Vercel manages this server's lifetime. The mission scheduler runs separately.
const app = await buildApp()
await app.listen({ host: env.HOST, port: env.PORT })
