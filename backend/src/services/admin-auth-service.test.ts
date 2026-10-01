import { UserRole } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { AppError } from '../errors/app-error.js'
import { assertAdminAccess } from './admin-auth-service.js'
import type { AuthenticatedUser } from './auth-service.js'

function user(role: UserRole, address: string): AuthenticatedUser {
  const now = new Date()
  return {
    id: 'user-1', username: null, role, createdAt: now, updatedAt: now,
    wallets: [{ id: 'wallet-1', address, userId: 'user-1', createdAt: now }],
  }
}

describe('admin authorization', () => {
  const approvedWallet = 'AdminWallet111111111111111111111111111111111'
  const allowlist = new Set([approvedWallet])

  it('denies a normal authenticated user access to administration', () => {
    expect(() => assertAdminAccess(user(UserRole.USER, approvedWallet), allowlist)).toThrowError(AppError)
    try { assertAdminAccess(user(UserRole.USER, approvedWallet), allowlist) } catch (error: unknown) {
      expect(error).toMatchObject({ code: 'ADMIN_ACCESS_REQUIRED', statusCode: 403 })
    }
  })

  it('denies an admin role when its wallet is no longer approved', () => {
    expect(() => assertAdminAccess(user(UserRole.ADMIN, 'DifferentWallet11111111111111111111111111111'), allowlist)).toThrowError(AppError)
  })

  it('allows only an admin role backed by an approved wallet', () => {
    expect(assertAdminAccess(user(UserRole.ADMIN, approvedWallet), allowlist).walletAddress).toBe(approvedWallet)
  })
})
