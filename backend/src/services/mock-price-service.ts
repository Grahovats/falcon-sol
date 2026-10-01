import { Prisma } from '@prisma/client'
import { AppError } from '../errors/app-error.js'
import type { MarketPrice, PriceMarket, PricePoint, PriceService } from './price-service.js'

interface PriceSettings {
  base: number
  amplitude: number
  frequency: number
  phase: number
}

const PRICE_INTERVAL_MS = 2_000
const DEMO_MARKETS: Record<string, PriceSettings> = {
  BONK: { base: 0.00002145, amplitude: 0.012, frequency: 0.31, phase: 0.4 },
  WIF: { base: 2.1845, amplitude: 0.009, frequency: 0.23, phase: 1.7 },
  POPCAT: { base: 0.7421, amplitude: 0.014, frequency: 0.19, phase: 2.9 },
  PENGU: { base: 0.03184, amplitude: 0.011, frequency: 0.27, phase: 4.2 },
  FARTCOIN: { base: 1.2634, amplitude: 0.016, frequency: 0.17, phase: 5.4 },
}

export class MockPriceService implements PriceService {
  constructor(private readonly clock: () => Date = () => new Date()) {}

  async getPrice(market: PriceMarket): Promise<MarketPrice> {
    const asOf = this.clock()
    const bucket = Math.floor(asOf.getTime() / PRICE_INTERVAL_MS)
    const price = this.priceAt(market.symbol, bucket)
    const previousPrice = this.priceAt(market.symbol, bucket - 1)
    return {
      marketId: market.id,
      symbol: market.symbol,
      price,
      changePercent: price.minus(previousPrice).div(previousPrice).mul(100),
      asOf,
      source: 'mock',
    }
  }

  async getPrices(markets: PriceMarket[]): Promise<MarketPrice[]> {
    return Promise.all(markets.map((market) => this.getPrice(market)))
  }

  async getPriceHistory(market: PriceMarket, points = 40): Promise<PricePoint[]> {
    const latestBucket = Math.floor(this.clock().getTime() / PRICE_INTERVAL_MS)
    return Array.from({ length: points }, (_, index) => {
      const bucket = latestBucket - (points - index - 1)
      return {
        timestamp: new Date(bucket * PRICE_INTERVAL_MS),
        price: this.priceAt(market.symbol, bucket),
      }
    })
  }

  private priceAt(symbol: string, bucket: number) {
    const settings = DEMO_MARKETS[symbol]
    if (!settings) throw new AppError('MARKET_NOT_AVAILABLE', `No demo price is configured for ${symbol}.`)

    const primaryWave = Math.sin(bucket * settings.frequency + settings.phase)
    const secondaryWave = Math.sin(bucket * settings.frequency * 0.37 + settings.phase * 1.8) * 0.35
    const factor = 1 + settings.amplitude * (primaryWave + secondaryWave)
    return new Prisma.Decimal((settings.base * factor).toPrecision(12))
  }
}

export const priceService = new MockPriceService()
