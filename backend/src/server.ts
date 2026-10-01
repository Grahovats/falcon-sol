import { buildApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { marketDataService } from './services/market-data.js'
import { MissionLifecycleService, startMissionLifecycleScheduler } from './services/mission-lifecycle-service.js'

const app = await buildApp()
let stopLifecycleScheduler: (() => void) | undefined

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down')
  stopLifecycleScheduler?.()
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

try {
  let databaseStatus = 'connected'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    databaseStatus = 'disconnected'
  }
  await app.listen({ host: env.HOST, port: env.PORT })
  stopLifecycleScheduler = startMissionLifecycleScheduler(
    new MissionLifecycleService(prisma, marketDataService),
    env.MISSION_LIFECYCLE_INTERVAL_MS,
    (error) => app.log.error(error, 'Mission lifecycle cycle failed'),
  )
  app.log.info({
    apiUrl: `http://localhost:${env.PORT}`,
    environment: env.NODE_ENV,
    database: databaseStatus,
  }, 'Falcon API started')
} catch (error: unknown) {
  app.log.error(error)
  await prisma.$disconnect()
  process.exit(1)
}
