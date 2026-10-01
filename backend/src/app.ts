import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { ZodError } from 'zod'
import { corsOrigins, env } from './config/env.js'
import { AppError } from './errors/app-error.js'
import { adminRoutes } from './routes/admin.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { missionRoutes } from './routes/missions.js'
import { profileRoutes } from './routes/profile.js'
import { tradingRoutes } from './routes/trading.js'

export async function buildApp() {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' })

  await app.register(cors, { origin: corsOrigins, credentials: true })
  await app.register(cookie)
  await app.register(rateLimit, { global: false })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      void reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues.map((issue) => issue.message).join(' '),
        },
      })
      return
    }

    if (error instanceof AppError) {
      void reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } })
      return
    }

    request.log.error(error)
    const statusCode = getStatusCode(error)
    void reply.code(statusCode).send({
      error: {
        code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED',
        message: statusCode >= 500 ? 'Internal server error.' : getErrorMessage(error),
      },
    })
  })

  app.setNotFoundHandler((_request, reply) => {
    void reply.code(404).send({ error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } })
  })

  await app.register(healthRoutes)
  await app.register(authRoutes, { prefix: '/api/v1' })
  await app.register(missionRoutes, { prefix: '/api/v1' })
  await app.register(tradingRoutes, { prefix: '/api/v1' })
  await app.register(profileRoutes, { prefix: '/api/v1' })
  await app.register(adminRoutes, { prefix: '/api/v1' })

  return app
}

function getStatusCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400) {
    return error.statusCode
  }
  return 500
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed'
}
