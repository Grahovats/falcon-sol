import { describe, expect, it, vi } from 'vitest'
import { GeckoTerminalCandleService } from './geckoterminal-candle-service.js'

const market = { id: 'market-1', symbol: 'BONK', mintAddress: 'bonk-mint', decimals: 5 }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function poolResponse(baseId = 'solana_bonk-mint', quoteId = 'solana_sol') {
  return {
    data: [{
      attributes: { address: 'pool-1', volume_usd: { h24: '12345' } },
      relationships: {
        base_token: { data: { id: baseId } },
        quote_token: { data: { id: quoteId } },
      },
    }],
  }
}

function candleResponse() {
  return { data: { attributes: { ohlcv_list: [
    [1_700_000_300, 2, 3, 1, 2.5, 100],
    [1_700_000_000, 1, 2, 0.5, 2, 80],
  ] } } }
}

describe('GeckoTerminalCandleService', () => {
  it('selects the liquid pool, requests real OHLC data, sorts it, and caches it', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(poolResponse()))
      .mockResolvedValueOnce(json(candleResponse()))
    const service = new GeckoTerminalCandleService({
      baseUrl: 'https://chart.test/api/v2',
      timeoutMs: 1_000,
      cacheTtlMs: 60_000,
      fetcher,
      clock: () => 1_000,
    })

    const [first, concurrent] = await Promise.all([service.getCandles(market, '5m'), service.getCandles(market, '5m')])
    const second = await service.getCandles(market, '5m')

    expect(concurrent).toEqual(first)
    expect(first.map((candle) => candle.time)).toEqual([1_700_000_000, 1_700_000_300])
    expect(second).toEqual(first)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('/pools/pool-1/ohlcv/minute')
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('aggregate=5')
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('token=base')
  })

  it('charts the quote side when the selected token is the pool quote token', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(poolResponse('solana_sol', 'solana_bonk-mint')))
      .mockResolvedValueOnce(json(candleResponse()))
    const service = new GeckoTerminalCandleService({ baseUrl: 'https://chart.test', timeoutMs: 1_000, cacheTtlMs: 60_000, fetcher })

    await service.getCandles(market, '1h')

    expect(String(fetcher.mock.calls[1]?.[0])).toContain('/ohlcv/hour')
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('token=quote')
  })
})
