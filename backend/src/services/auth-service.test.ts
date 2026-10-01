import bs58 from 'bs58'
import nacl from 'tweetnacl'
import { describe, expect, it } from 'vitest'
import { AppError } from '../errors/app-error.js'
import { createAuthMessage, createAuthNonce, hashSessionToken, validateWalletAddress, verifyWalletSignature } from './auth-service.js'

describe('wallet authentication', () => {
  it('creates a SIWS-compatible alphanumeric nonce', () => {
    const nonce = createAuthNonce()
    expect(nonce).toMatch(/^[A-Za-z0-9]{8,}$/)
    expect(createAuthNonce()).not.toBe(nonce)
  })

  it('verifies a signature from the claimed Solana wallet', () => {
    const keypair = nacl.sign.keyPair()
    const walletAddress = bs58.encode(keypair.publicKey)
    const message = createAuthMessage(walletAddress, 'nonce-123', new Date('2026-09-30T10:00:00.000Z'), new Date('2026-09-30T10:05:00.000Z'))
    const signature = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey)

    expect(() => verifyWalletSignature(message, Buffer.from(signature).toString('base64'), walletAddress)).not.toThrow()
  })

  it('rejects a signature made by another wallet', () => {
    const claimed = nacl.sign.keyPair()
    const attacker = nacl.sign.keyPair()
    const walletAddress = bs58.encode(claimed.publicKey)
    const message = 'Falcon authentication challenge'
    const signature = nacl.sign.detached(new TextEncoder().encode(message), attacker.secretKey)

    expect(() => verifyWalletSignature(message, Buffer.from(signature).toString('base64'), walletAddress)).toThrow(AppError)
  })

  it('rejects invalid public keys and hashes opaque session tokens', () => {
    expect(() => validateWalletAddress('not-a-solana-wallet')).toThrow(AppError)
    expect(hashSessionToken('session-a')).toHaveLength(64)
    expect(hashSessionToken('session-a')).not.toBe(hashSessionToken('session-b'))
  })
})
