import type { MissionMarket } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'

export type PriceMarket = Pick<MissionMarket, 'id' | 'symbol' | 'mintAddress' | 'decimals'>

export interface MarketPrice {
  marketId: string
  symbol: string
  price: Decimal
  changePercent: Decimal
  asOf: Date
  source: 'mock' | 'jupiter'
}

export interface PricePoint {
  timestamp: Date
  price: Decimal
}

export interface PriceService {
  getPrice(market: PriceMarket): Promise<MarketPrice>
  getPrices(markets: PriceMarket[]): Promise<MarketPrice[]>
  getPriceHistory(market: PriceMarket, points?: number): Promise<PricePoint[]>
}

export interface ExecutionQuote {
  provider: 'mock' | 'jupiter'
  requestId: string | null
  quoteId: string | null
  router: string | null
  inputMint: string
  outputMint: string
  inputAmount: string
  outputAmount: string
  quantity: Decimal
  notional: Decimal
  executionPrice: Decimal
  referencePrice: Decimal
  priceImpactPercent: Decimal
  simulatedFee: Decimal
  routePlan: unknown[]
  quotedAt: Date
  expiresAt: Date | null
}

export interface MarketDataService extends PriceService {
  getBuyQuote(market: PriceMarket, notional: Decimal): Promise<ExecutionQuote>
  getSellQuote(market: PriceMarket, quantity: Decimal): Promise<ExecutionQuote>
}
