import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { marketDataService } from './services/market-data.js'
import { MissionLifecycleService, startMissionLifecycleScheduler } from './services/mission-lifecycle-service.js'

// Run on a persistent worker host against the same database as the Vercel API.
const stop = startMissionLifecycleScheduler(
  new MissionLifecycleService(prisma, marketDataService),
  env.MISSION_LIFECYCLE_INTERVAL_MS,
  (error) => console.error('Mission lifecycle cycle failed', error),
)

// The scheduler's timer is unreferenced for use inside the standalone API server.
// Keep the dedicated worker alive even when there are no database requests.
const keepAlive = setInterval(() => {}, 60_000)

async function shutdown() {
  stop()
  clearInterval(keepAlive)
  await prisma.$disconnect()
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
