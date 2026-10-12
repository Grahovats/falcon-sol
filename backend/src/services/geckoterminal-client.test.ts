import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeckoTerminalClient } from './geckoterminal-client.js'

const code = 'CANDLE_DATA_UNAVAILABLE' as const
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers })
afterEach(() => vi.useRealTimers())

describe('shared GeckoTerminal request budget', () => {
  it('spaces requests for different coins, shares identical requests, and caches responses', async () => {
    vi.useFakeTimers()
    const calls: number[] = []
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => { calls.push(Date.now()); return json({ data: [] }) })
    const client = new GeckoTerminalClient({ baseUrl: 'https://chart.test', timeoutMs: 1000, fetcher })
    const requests = Promise.all([
      client.requestJson('/bonk', code), client.requestJson('/wif', code),
      client.requestJson('/bonk', code), client.requestJson('/trending', 'TRENDING_MARKETS_UNAVAILABLE'),
    ])
    await vi.advanceTimersByTimeAsync(5000)
    await requests
    expect(calls).toHaveLength(3)
    expect(calls[1]! - calls[0]!).toBeGreaterThanOrEqual(2200)
    expect(calls[2]! - calls[1]!).toBeGreaterThanOrEqual(2200)
    await client.requestJson('/bonk', code)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('honors Retry-After across all endpoints and resumes after cooldown', async () => {
    let now = 1000
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 429, { 'retry-after': '12' })).mockResolvedValue(json({ data: [] }))
    const client = new GeckoTerminalClient({ baseUrl: 'https://chart.test', timeoutMs: 1000, intervalMs: 0, fetcher, clock: () => now })
    await expect(client.requestJson('/bonk', code)).rejects.toMatchObject({ statusCode: 429, retryAfterSeconds: 12 })
    now += 2000
    await expect(client.requestJson('/wif', code)).rejects.toMatchObject({ retryAfterSeconds: 10 })
    await expect(client.requestJson('/trending', 'TRENDING_MARKETS_UNAVAILABLE')).rejects.toMatchObject({ statusCode: 429 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    now += 10_000
    await expect(client.requestJson('/wif', code)).resolves.toEqual({ data: [] })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('uses a one-minute cooldown without provider guidance and accepts date headers', async () => {
    const now = Date.parse('2026-10-12T12:00:00Z')
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 429)).mockResolvedValueOnce(json({}, 429, { 'retry-after': 'Mon, 12 Oct 2026 12:00:20 GMT' }))
    const options = { baseUrl: 'https://chart.test', timeoutMs: 1000, intervalMs: 0, fetcher, clock: () => now }
    await expect(new GeckoTerminalClient(options).requestJson('/bonk', code)).rejects.toMatchObject({ retryAfterSeconds: 60 })
    await expect(new GeckoTerminalClient(options).requestJson('/wif', code)).rejects.toMatchObject({ retryAfterSeconds: 20 })
  })

  it('propagates retry timing to the browser through the API response', async () => {
    const { buildApp } = await import('../app.js')
    const { AppError } = await import('../errors/app-error.js')
    const app = await buildApp()
    app.get('/test-chart-limit', async () => { throw new AppError(code, 'Wait for chart data.', 429, 12) })
    try {
      const response = await app.inject({ method: 'GET', url: '/test-chart-limit' })
      expect(response.statusCode).toBe(429)
      expect(response.headers['retry-after']).toBe('12')
      expect(response.json().error.code).toBe(code)
    } finally { await app.close() }
  })
})
