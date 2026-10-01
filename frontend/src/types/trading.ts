export type OrderSide = 'BUY' | 'SELL'
export type CandleTimeframe = '5m' | '15m' | '1h' | '4h'

export interface MarketCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CandleResponse {
  data: MarketCandle[]
  meta: { timeframe: CandleTimeframe; source: 'geckoterminal' }
}

export interface MarketPrice {
  marketId: string
  symbol: string
  mintAddress: string
  enabled: boolean
  currentPrice: string
  changePercent: string
  asOf: string
  source: 'mock' | 'jupiter'
  history: PricePoint[]
}

export interface PricePoint { timestamp: string; price: string }

export interface Position {
  marketId: string
  symbol: string
  quantity: string
  averageEntryPrice: string
  currentPrice: string
  marketValue: string
  realizedPnl: string
  unrealizedPnl: string
  unrealizedPnlPercent: string
  allocationPercent: string
}

export interface Portfolio {
  entryId: string
  userId: string
  startingBalance: string
  cashBalance: string
  realizedPnl: string
  unrealizedPnl: string
  totalEquity: string
  totalPnl: string
  returnPercent: string
  positions: Position[]
}

export interface LeaderboardRow {
  rank: number
  userId: string
  displayName: string
  wallet: string | null
  equity: string
  pnl: string
  returnPercent: string
}

export interface LeaderboardResponse {
  data: LeaderboardRow[]
  meta: { hidden: boolean; status: string }
}

export interface OrderHistoryItem {
  id: string
  timestamp: string
  marketId: string
  symbol: string
  side: OrderSide
  quantity: string | null
  executionPrice: string | null
  notional: string
  status: string
  quoteProvider: string | null
  quoteRouter: string | null
  priceImpactPercent: string | null
  simulatedFee: string | null
  referencePrice: string | null
}

export interface OrderRequest {
  marketId: string
  side: OrderSide
  notional?: number
  quantity?: number
}

export interface OrderExecution {
  order: { id: string; side: OrderSide; status: string }
  fill: { executionPrice: string; referencePrice: string | null; quantity: string; notional: string; simulatedFee: string; priceImpactPercent: string | null; quoteProvider: string; quoteRequestId: string | null; quoteId: string | null; quoteRouter: string | null }
  portfolio: Portfolio
}
