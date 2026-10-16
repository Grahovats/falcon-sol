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

describe('mission token icons', () => {
  it('shares an in-flight batch, caches logos by mint, and preserves missing-icon fallbacks', async () => {
    const icon = 'https://example.com/bonk.png'
    const otherMint = 'So11111111111111111111111111111111111111112'
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([token({ icon }), token({ id: otherMint })]))
    const tokens = service(fetcher)
    const [first, concurrent] = await Promise.all([tokens.getIcons([mint, otherMint]), tokens.getIcons([otherMint, mint])])
    expect(first).toEqual({ [mint]: icon, [otherMint]: null })
    expect(concurrent).toEqual(first)
    expect(await tokens.getIcons([mint])).toEqual({ [mint]: icon })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('keeps provider failures optional and caches the fallback briefly', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 429))
    const tokens = service(fetcher)
    await expect(tokens.getIcons([mint])).resolves.toEqual({ [mint]: null })
    await expect(tokens.getIcons([mint])).resolves.toEqual({ [mint]: null })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('ignores invalid and non-HTTPS image URLs without dropping token metadata', async () => {
    for (const icon of ['javascript:alert(1)', 'http://example.com/icon.png', 'not a url']) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([token({ icon })]))
      expect(await service(fetcher).getIcons([mint])).toEqual({ [mint]: null })
    }
  })

  it('batches larger rosters within the provider limit of 100 mint addresses', async () => {
    const mints = Array.from({ length: 101 }, (_, index) => `mint-${index}`)
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async input => {
      const ids = new URL(String(input)).searchParams.get('query')!.split(',')
      expect(ids.length).toBeLessThanOrEqual(100)
      return jsonResponse(ids.map(id => token({ id, icon: `https://example.com/${id}.png` })))
    })
    const icons = await service(fetcher).getIcons(mints)
    expect(Object.keys(icons)).toHaveLength(101)
    expect(icons['mint-100']).toBe('https://example.com/mint-100.png')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
