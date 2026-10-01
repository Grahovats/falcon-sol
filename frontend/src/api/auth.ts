import type { ApiEnvelope } from '../types/mission'
import { apiGet, apiPost } from './client'

export interface AuthUser {
  userId: string
  username: string
  wallet: string
  role: 'USER' | 'ADMIN'
}

interface Challenge {
  challengeId: string
  message: string
  expiresAt: string
}

export function getSession(signal?: AbortSignal) {
  return apiGet<ApiEnvelope<AuthUser | null>>('/auth/session', signal)
}

export function createChallenge(walletAddress: string) {
  return apiPost<ApiEnvelope<Challenge>>('/auth/challenge', { walletAddress })
}

export function verifyChallenge(challengeId: string, walletAddress: string, signature: Uint8Array) {
  return apiPost<ApiEnvelope<AuthUser>>('/auth/verify', {
    challengeId,
    walletAddress,
    signature: bytesToBase64(signature),
  })
}

export function logout() {
  return apiPost<void>('/auth/logout')
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window.btoa(binary)
}
