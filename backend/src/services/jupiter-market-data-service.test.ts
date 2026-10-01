import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { JupiterMarketDataService } from './jupiter-market-data-service.js'

const market = {
  id: 'bonk-market',
  symbol: 'BONK',
  mintAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  decimals: 5,
}

function service(fetcher: typeof fetch, maxPriceImpactPercent = 5, clock: () => Date = () => new Date('2026-09-30T10:00:00.000Z'), priceCacheTtlMs = 10_000) {
  return new JupiterMarketDataService({
    apiKey: 'test-key',
    baseUrl: 'https://api.jup.ag',
    usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    timeoutMs: 1_000,
    maxPriceImpactPercent,
    priceCacheTtlMs,
    stalePriceMaxAgeMs: 300_000,
    fetcher,
    clock,
  })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('JupiterMarketDataService', () => {
  it('maps Price V3 data and records real observations for chart history', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      [market.mintAddress]: { usdPrice: 0.00001234, blockId: 123, decimals: 5, priceChange24h: 2.5 },
    }))
    const client = service(fetcher)
    const price = await client.getPrice(market)

    expect(price.price.toString()).toBe('0.00001234')
    expect(price.changePercent.toString()).toBe('2.5')
    expect(price.source).toBe('jupiter')
    expect(await client.getPriceHistory(market)).toHaveLength(1)
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/price/v3?ids=')
  })

  it('coalesces concurrent price loads and serves repeated polling from cache', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      [market.mintAddress]: { usdPrice: 0.00001234, blockId: 123, decimals: 5, priceChange24h: 2.5 },
    }))
    const client = service(fetcher)

    const [first, second] = await Promise.all([client.getPrice(market), client.getPrice(market)])
    const third = await client.getPrice(market)

    expect(first.price.toString()).toBe(second.price.toString())
    expect(third.price.toString()).toBe(first.price.toString())
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('keeps serving the last safe spot price when Jupiter temporarily rate limits refreshes', async () => {
    let now = new Date('2026-09-30T10:00:00.000Z')
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ [market.mintAddress]: { usdPrice: 0.00001234, blockId: 123, decimals: 5, priceChange24h: 2.5 } }))
      .mockResolvedValueOnce(jsonResponse({}, 429))
    const client = service(fetcher, 5, () => now, 1_000)

    const fresh = await client.getPrice(market)
    now = new Date(now.getTime() + 2_000)
    const fallback = await client.getPrice(market)

    expect(fallback.price.toString()).toBe(fresh.price.toString())
    expect(fallback.asOf).toEqual(fresh.asOf)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('turns a Swap V2 quote-only order into an auditable synthetic BUY fill', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      outputMint: market.mintAddress,
      inAmount: '100000000',
      outAmount: '800000000000',
      priceImpact: -0.25,
      routePlan: [{ swapInfo: { label: 'Meteora DLMM' }, percent: 100 }],
      feeBps: 10,
      router: 'metis',
      requestId: 'request-1',
      quoteId: null,
      expireAt: null,
    }))
    const quote = await service(fetcher).getBuyQuote(market, new Prisma.Decimal(100))

    expect(quote.provider).toBe('jupiter')
    expect(quote.quantity.toString()).toBe('8000000')
    expect(quote.notional.toString()).toBe('100')
    expect(quote.executionPrice.toString()).toBe('0.0000125')
    expect(quote.priceImpactPercent.toString()).toBe('0.25')
    expect(quote.simulatedFee.toString()).toBe('0.1')
    const url = new URL(String(fetcher.mock.calls[0]?.[0]))
    expect(url.pathname).toBe('/swap/v2/order')
    expect(url.searchParams.get('amount')).toBe('100000000')
    expect(url.searchParams.has('taker')).toBe(false)
  })

  it('blocks quotes over the configured price-impact ceiling', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8fBopzLHYxdM65zcjm',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inAmount: '1000000',
      outAmount: '1000000',
      priceImpact: -8,
      routePlan: [],
      feeBps: 10,
      router: 'metis',
      requestId: 'request-2',
    }))
    const wif = { ...market, symbol: 'WIF', mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8fBopzLHYxdM65zcjm', decimals: 6 }

    await expect(service(fetcher, 5).getSellQuote(wif, new Prisma.Decimal(1))).rejects.toMatchObject({
      code: 'PRICE_IMPACT_TOO_HIGH',
      statusCode: 422,
    })
  })

  it('returns a recoverable service error when Jupiter is unavailable', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('network down'))
    await expect(service(fetcher).getPrice(market)).rejects.toMatchObject({
      code: 'MARKET_DATA_UNAVAILABLE',
      statusCode: 503,
    })
  })

  it('fails clearly when live mode has no API key', async () => {
    const client = new JupiterMarketDataService({
      apiKey: undefined,
      baseUrl: 'https://api.jup.ag',
      usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      timeoutMs: 1_000,
      maxPriceImpactPercent: 5,
      priceCacheTtlMs: 10_000,
      stalePriceMaxAgeMs: 300_000,
    })
    await expect(client.getPrice(market)).rejects.toMatchObject({
      code: 'MARKET_DATA_CONFIGURATION_ERROR',
      statusCode: 503,
    })
  })
})
