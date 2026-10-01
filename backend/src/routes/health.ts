import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { status: 'ok' as const, database: 'connected' as const, service: 'falcon-api' as const }
    } catch (error: unknown) {
      app.log.error(error, 'Database health check failed')
      return reply.code(503).send({ status: 'error', database: 'disconnected', service: 'falcon-api' })
    }
  })
}
