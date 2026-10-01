import { Prisma, UserRole } from '@prisma/client'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { adminWalletAddresses, corsOrigins, env } from '../config/env.js'
import { AppError } from '../errors/app-error.js'
import { prisma } from '../lib/prisma.js'
import {
  clearSessionCookie,
  createAuthMessage,
  createAuthNonce,
  createSessionToken,
  getAuthenticatedUser,
  hashSessionToken,
  serializeAuthUser,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  validateWalletAddress,
  verifyWalletSignature,
} from '../services/auth-service.js'

const walletSchema = z.object({ walletAddress: z.string().trim().min(32).max(44) })
const verifySchema = walletSchema.extend({ challengeId: z.string().min(1), signature: z.string().min(1) })

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/challenge', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { walletAddress } = walletSchema.parse(request.body)
    validateWalletAddress(walletAddress)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + env.AUTH_CHALLENGE_TTL_SECONDS * 1_000)
    const nonce = createAuthNonce()
    const requestOrigin = request.headers.origin
    const authUri = requestOrigin && corsOrigins.includes(requestOrigin) ? requestOrigin : env.AUTH_URI
    const message = createAuthMessage(walletAddress, nonce, now, expiresAt, authUri)
    await prisma.authChallenge.deleteMany({ where: { expiresAt: { lt: now } } })
    const challenge = await prisma.authChallenge.create({ data: { walletAddress, message, expiresAt } })
    return reply.code(201).send({ data: { challengeId: challenge.id, message, expiresAt: expiresAt.toISOString() } })
  })

  app.post('/auth/verify', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { challengeId, walletAddress, signature } = verifySchema.parse(request.body)
    const challenge = await prisma.authChallenge.findUnique({ where: { id: challengeId } })
    if (!challenge || challenge.walletAddress !== walletAddress) throw new AppError('AUTH_CHALLENGE_NOT_FOUND', 'The sign-in request was not found.', 404)
    if (challenge.consumedAt) throw new AppError('AUTH_CHALLENGE_CONSUMED', 'This sign-in request has already been used.', 409)
    if (challenge.expiresAt <= new Date()) throw new AppError('AUTH_CHALLENGE_EXPIRED', 'This sign-in request expired. Try again.', 401)
    verifyWalletSignature(challenge.message, signature, walletAddress)

    const token = createSessionToken()
    const sessionExpiresAt = new Date(Date.now() + env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1_000)
    const user = await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.authChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: new Date() } })
      if (consumed.count !== 1) throw new AppError('AUTH_CHALLENGE_CONSUMED', 'This sign-in request has already been used.', 409)
      const existing = await transaction.wallet.findUnique({ where: { address: walletAddress }, include: { user: { include: { wallets: { orderBy: { createdAt: 'asc' } } } } } })
      const desiredRole = adminWalletAddresses.has(walletAddress) ? UserRole.ADMIN : UserRole.USER
      let authenticatedUser = existing?.user ?? await transaction.user.create({ data: { role: desiredRole, wallets: { create: { address: walletAddress } } }, include: { wallets: { orderBy: { createdAt: 'asc' } } } })
      if (authenticatedUser.role !== desiredRole) {
        const updated = await transaction.user.update({ where: { id: authenticatedUser.id }, data: { role: desiredRole } })
        authenticatedUser = { ...authenticatedUser, role: updated.role }
      }
      await transaction.session.create({ data: { tokenHash: hashSessionToken(token), userId: authenticatedUser.id, expiresAt: sessionExpiresAt } })
      return authenticatedUser
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    setSessionCookie(reply, token)
    return { data: serializeAuthUser(user) }
  })

  app.get('/auth/session', async (request, reply) => {
    try {
      const user = await getAuthenticatedUser(prisma, request)
      return { data: serializeAuthUser(user) }
    } catch (error: unknown) {
      if (error instanceof AppError && error.code === 'AUTHENTICATION_REQUIRED') {
        clearSessionCookie(reply)
        return { data: null }
      }
      throw error
    }
  })

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME]
    if (token) await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
    clearSessionCookie(reply)
    return reply.code(204).send()
  })
}
