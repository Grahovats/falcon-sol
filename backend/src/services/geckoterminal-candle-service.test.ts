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
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('limit=1000')
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

  it('separates older-page caches, excludes boundary candles, and accepts exhausted history', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(poolResponse()))
      .mockResolvedValueOnce(json(candleResponse()))
      .mockResolvedValueOnce(json(candleResponse()))
      .mockResolvedValueOnce(json({ data: { attributes: { ohlcv_list: [] } } }))
    const service = new GeckoTerminalCandleService({ baseUrl: 'https://chart.test', timeoutMs: 1_000, cacheTtlMs: 60_000, fetcher })
    const latest = await service.getCandles(market, '5m')
    const older = await service.getCandles(market, '5m', 1_700_000_300)
    expect(older.map(candle => candle.time)).toEqual([1_700_000_000])
    expect(String(fetcher.mock.calls[2]?.[0])).toContain('before_timestamp=1700000300')
    expect(await service.getCandles(market, '5m')).toEqual(latest)
    expect(await service.getCandles(market, '5m', 1_700_000_300)).toEqual(older)
    expect(await service.getCandles(market, '5m', 1_700_000_000)).toEqual([])
    expect(await service.getCandles(market, '5m', 1_700_000_000)).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it.each([['1m', 'minute'], ['1d', 'day']] as const)('requests the %s interval', async (timeframe, unit) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(poolResponse())).mockResolvedValueOnce(json(candleResponse()))
    const service = new GeckoTerminalCandleService({ baseUrl: 'https://chart.test', timeoutMs: 1_000, cacheTtlMs: 60_000, fetcher })
    await service.getCandles(market, timeframe)
    expect(String(fetcher.mock.calls[1]?.[0])).toContain(`/ohlcv/${unit}?aggregate=1`)
  })

  it('shares pool discovery across timeframes for the same coin', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => json(String(url).includes('/tokens/') ? poolResponse() : candleResponse()))
    const service = new GeckoTerminalCandleService({ baseUrl: 'https://chart.test', timeoutMs: 1000, cacheTtlMs: 60_000, fetcher })
    await Promise.all([service.getCandles(market, '5m'), service.getCandles(market, '1h')])
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/tokens/'))).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('keeps cached chart candles during throttling, labels them stale, and bounds their age', async () => {
    let now = 1000
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(poolResponse())).mockResolvedValueOnce(json(candleResponse())).mockResolvedValue(json({}, 429))
    const service = new GeckoTerminalCandleService({ baseUrl: 'https://chart.test', timeoutMs: 1000, cacheTtlMs: 60_000, fetcher, clock: () => now })
    const fresh = await service.getCandlePage(market, '5m')
    now += 61_000
    const [stale, concurrent] = await Promise.all([service.getCandlePage(market, '5m'), service.getCandlePage(market, '5m')])
    expect(stale).toEqual({ ...fresh, stale: true })
    expect(concurrent).toEqual(stale)
    now += 10 * 60_000
    await expect(service.getCandlePage(market, '5m')).rejects.toMatchObject({ code: 'CANDLE_DATA_UNAVAILABLE' })
  })
})
