import { describe, expect, it } from 'vitest'
import { resolveSolanaRpcUrl } from './solana-rpc.js'

describe('Solana RPC configuration', () => {
  it('uses mainnet Helius and encodes the server-side key', () => {
    const url = new URL(resolveSolanaRpcUrl(undefined, 'test&key=value'))
    expect(url.hostname).toBe('mainnet.helius-rpc.com')
    expect(url.searchParams.get('api-key')).toBe('test&key=value')
  })
  it('preserves an explicit RPC override', () => {
    expect(resolveSolanaRpcUrl('https://rpc.test/', 'test-key')).toBe('https://rpc.test/')
  })
  it('uses public mainnet when no credentials are configured', () => {
    expect(resolveSolanaRpcUrl()).toBe('https://api.mainnet-beta.solana.com')
  })
})
