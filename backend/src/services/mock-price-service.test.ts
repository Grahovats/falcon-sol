import { describe, expect, it } from 'vitest'
import { MockPriceService } from './mock-price-service.js'

const market = { id: 'bonk-market', symbol: 'BONK', mintAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 }

describe('MockPriceService', () => {
  it('is deterministic for a fixed time and returns ordered history', async () => {
    const clock = () => new Date('2026-09-29T12:00:00.000Z')
    const service = new MockPriceService(clock)
    const first = await service.getPrice(market)
    const second = await service.getPrice(market)
    expect(first.price.toString()).toBe(second.price.toString())

    const history = await service.getPriceHistory(market, 5)
    expect(history).toHaveLength(5)
    expect(history[0]?.timestamp.getTime()).toBeLessThan(history[4]?.timestamp.getTime() ?? 0)
  })

  it('keeps demo movement within a small range of the base price', async () => {
    const service = new MockPriceService(() => new Date('2026-09-29T12:00:10.000Z'))
    const result = await service.getPrice(market)
    expect(result.price.toNumber()).toBeGreaterThan(0.000020)
    expect(result.price.toNumber()).toBeLessThan(0.000023)
  })
})
