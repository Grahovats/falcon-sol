import { describe, expect, it, vi } from 'vitest'
import { GeckoTerminalTrendingService } from './geckoterminal-trending-service.js'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function trendingResponse() {
  const symbols = ['SOL', 'PEPE', 'DOGE', 'WIF', 'BONK', 'POPCAT', 'PENGU', 'PNUT', 'MEW', 'MOODENG', 'GOAT', 'GIGA']
  return {
    data: symbols.map((symbol, index) => ({
      attributes: { base_token_price_usd: String((index + 1) / 100), price_change_percentage: { h24: String(index - 3) } },
      relationships: { base_token: { data: { id: `solana_mint-${symbol}` } } },
    })),
    included: symbols.map((symbol) => ({
      id: `solana_mint-${symbol}`,
      type: 'token',
      attributes: { address: `mint-${symbol}`, name: `${symbol} token`, symbol },
    })),
  }
}

describe('GeckoTerminalTrendingService', () => {
  it('returns ten unique trending tokens without majors and caches the response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(trendingResponse()))
    const service = new GeckoTerminalTrendingService({
      baseUrl: 'https://trending.test/api/v2',
      timeoutMs: 1_000,
      cacheTtlMs: 60_000,
      fetcher,
      clock: () => 1_000,
    })

    const first = await service.getTrending(10)
    const second = await service.getTrending(10)

    expect(first).toHaveLength(10)
    expect(first.some((market) => market.symbol === 'SOL')).toBe(false)
    expect(first[0]).toMatchObject({ symbol: 'PEPE', source: 'geckoterminal' })
    expect(second).toEqual(first)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/networks/solana/trending_pools?')
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('duration=24h')
  })

  it('rejects an empty provider result instead of inventing test prices', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ data: [], included: [] }))
    const service = new GeckoTerminalTrendingService({ baseUrl: 'https://trending.test', timeoutMs: 1_000, cacheTtlMs: 60_000, fetcher })

    await expect(service.getTrending()).rejects.toMatchObject({ code: 'TRENDING_MARKETS_UNAVAILABLE' })
  })
})
