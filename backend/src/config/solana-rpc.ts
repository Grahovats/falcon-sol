/** Explicit RPC URLs win; otherwise a Helius key selects its mainnet endpoint. */
export function resolveSolanaRpcUrl(rpcUrl?: string, heliusApiKey?: string) {
  if (rpcUrl) return rpcUrl
  if (heliusApiKey) {
    const url = new URL('https://mainnet.helius-rpc.com/')
    url.searchParams.set('api-key', heliusApiKey)
    return url.toString()
  }
  return 'https://api.mainnet-beta.solana.com'
}
