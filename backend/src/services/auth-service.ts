import { createHash, randomBytes } from 'node:crypto'
import { UserRole, type PrismaClient, type User, type Wallet } from '@prisma/client'
import bs58 from 'bs58'
import type { FastifyReply, FastifyRequest } from 'fastify'
import nacl from 'tweetnacl'
import { adminWalletAddresses, env } from '../config/env.js'
import { AppError } from '../errors/app-error.js'

export const SESSION_COOKIE_NAME = 'falcon_session'

export function validateWalletAddress(address: string) {
  try {
    const bytes = bs58.decode(address)
    if (bytes.length !== nacl.sign.publicKeyLength) throw new Error('Invalid public key length')
    return bytes
  } catch {
    throw new AppError('INVALID_WALLET_ADDRESS', 'Enter a valid Solana wallet address.')
  }
}

export function createAuthMessage(walletAddress: string, nonce: string, issuedAt: Date, expiresAt: Date, authUri = env.AUTH_URI) {
  const domain = new URL(authUri).host || env.AUTH_DOMAIN
  return `${domain} wants you to sign in with your Solana account:\n${walletAddress}\n\nSign in to Falcon. This request will not trigger a blockchain transaction.\n\nURI: ${authUri}\nVersion: 1\nChain ID: solana:mainnet\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}`
}

export function verifyWalletSignature(message: string, signatureBase64: string, walletAddress: string) {
  const publicKey = validateWalletAddress(walletAddress)
  const signature = Buffer.from(signatureBase64, 'base64')
  if (signature.length !== nacl.sign.signatureLength || !nacl.sign.detached.verify(new TextEncoder().encode(message), signature, publicKey)) {
    throw new AppError('INVALID_SIGNATURE', 'The wallet signature could not be verified.', 401)
  }
}

export function createAuthNonce() {
  return randomBytes(24).toString('hex')
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
}

export type AuthenticatedUser = User & { wallets: Wallet[] }

export async function getAuthenticatedUser(prisma: PrismaClient, request: FastifyRequest): Promise<AuthenticatedUser> {
  const token = request.cookies[SESSION_COOKIE_NAME]
  if (!token) throw new AppError('AUTHENTICATION_REQUIRED', 'Connect and sign in with your wallet to continue.', 401)
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { include: { wallets: { orderBy: { createdAt: 'asc' } } } } },
  })
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } })
    throw new AppError('AUTHENTICATION_REQUIRED', 'Your Falcon session expired. Sign in again.', 401)
  }
  const shouldBeAdmin = session.user.wallets.some((wallet) => adminWalletAddresses.has(wallet.address))
  const desiredRole = shouldBeAdmin ? UserRole.ADMIN : UserRole.USER
  if (session.user.role !== desiredRole) {
    const updated = await prisma.user.update({ where: { id: session.user.id }, data: { role: desiredRole } })
    return { ...session.user, role: updated.role }
  }
  return session.user
}

export function serializeAuthUser(user: AuthenticatedUser) {
  const wallet = user.wallets[0]?.address ?? null
  return {
    userId: user.id,
    username: user.username ?? (wallet ? `operator-${wallet.slice(0, 4).toLowerCase()}` : 'operator'),
    wallet,
    role: user.role,
  }
}
