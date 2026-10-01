import { UserRole, type PrismaClient } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { adminWalletAddresses } from '../config/env.js'
import { AppError } from '../errors/app-error.js'
import { getAuthenticatedUser, type AuthenticatedUser } from './auth-service.js'

export function assertAdminAccess(user: AuthenticatedUser, allowlist: ReadonlySet<string> = adminWalletAddresses) {
  const approvedWallet = user.wallets.find((wallet) => allowlist.has(wallet.address))
  if (user.role !== UserRole.ADMIN || !approvedWallet) {
    throw new AppError('ADMIN_ACCESS_REQUIRED', 'This wallet is not authorized for Falcon mission control.', 403)
  }
  return { user, walletAddress: approvedWallet.address }
}

export async function getAdminUser(database: PrismaClient, request: FastifyRequest) {
  return assertAdminAccess(await getAuthenticatedUser(database, request))
}
