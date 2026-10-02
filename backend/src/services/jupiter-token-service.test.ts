import { describe, expect, it, vi } from 'vitest'
import { JupiterTokenService } from './jupiter-token-service.js'

const mint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function service(fetcher: typeof fetch, minLiquidityUsd = 10_000) {
  return new JupiterTokenService({
    apiKey: 'test-key',
    baseUrl: 'https://api.jup.ag',
    timeoutMs: 1_000,
    minLiquidityUsd,
    fetcher,
  })
}

function token(overrides: Record<string, unknown> = {}) {
  return {
    id: mint,
    name: 'Bonk',
    symbol: 'Bonk',
    decimals: 5,
    firstPool: { createdAt: '2022-12-25T00:00:00Z' },
    holderCount: 900_000,
    audit: { mintAuthorityDisabled: true, freezeAuthorityDisabled: true, topHoldersPercentage: 18 },
    organicScore: 72,
    organicScoreLabel: 'high',
    isVerified: true,
    usdPrice: 0.000012,
    liquidity: 12_000_000,
    stats5m: { priceChange: 4, buyVolume: 10, sellVolume: 20, numTraders: 12 },
    stats1h: { priceChange: -2 },
    stats24h: { priceChange: 15, buyVolume: 1_000_000, sellVolume: 900_000 },
    ...overrides,
  }
}

describe('JupiterTokenService', () => {
  it('maps Jupiter Tokens V2 metadata into an eligible token candidate', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([token()]))
    const [candidate] = await service(fetcher).search('BONK')

    expect(candidate).toMatchObject({
      mintAddress: mint,
      symbol: 'BONK',
      liquidityUsd: 12_000_000,
      priceChange24h: 15,
      volume24hUsd: 1_900_000,
      eligible: true,
      warnings: [],
    })
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/tokens/v2/search?query=BONK')
  })

  it('marks thin, risky launches ineligible while preserving safety warnings', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([token({
      liquidity: 500,
      isVerified: false,
      organicScore: 10,
      audit: { mintAuthorityDisabled: false, freezeAuthorityDisabled: false, topHoldersPercentage: 75 },
    })]))
    const [candidate] = await service(fetcher).recent()

    expect(candidate?.eligible).toBe(false)
    expect(candidate?.ineligibleReasons).toContain('Liquidity below $10,000')
    expect(candidate?.warnings).toEqual(expect.arrayContaining(['Unverified token', 'Mint authority enabled', 'Freeze authority enabled', 'Top holders own at least 50%', 'Low organic activity score']))
  })

  it('resolves an exact mint and rejects invalid Solana addresses before requesting', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([token()]))
    await expect(service(fetcher).resolveMint(mint)).resolves.toMatchObject({ mintAddress: mint })
    await expect(service(fetcher).resolveMint('not-a-mint')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
