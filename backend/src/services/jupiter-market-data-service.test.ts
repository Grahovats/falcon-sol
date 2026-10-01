import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { JupiterMarketDataService } from './jupiter-market-data-service.js'

const market = {
  id: 'bonk-market',
  symbol: 'BONK',
  mintAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  decimals: 5,
}

function service(fetcher: typeof fetch, maxPriceImpactPercent = 5) {
  return new JupiterMarketDataService({
    apiKey: 'test-key',
    baseUrl: 'https://api.jup.ag',
    usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    timeoutMs: 1_000,
    maxPriceImpactPercent,
    fetcher,
    clock: () => new Date('2026-09-30T10:00:00.000Z'),
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
    })
    await expect(client.getPrice(market)).rejects.toMatchObject({
      code: 'MARKET_DATA_CONFIGURATION_ERROR',
      statusCode: 503,
    })
  })
})
