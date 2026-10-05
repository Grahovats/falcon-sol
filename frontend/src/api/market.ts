import type { ApiEnvelope } from '../types/mission'
import { apiGet } from './client'

export interface TrendingMemeMarket {
  marketId: string
  symbol: string
  name: string
  mintAddress: string
  currentPrice: string
  changePercent: string
  asOf: string
  source: 'geckoterminal'
}

export function getTrendingMemeMarkets(signal?: AbortSignal) {
  return apiGet<ApiEnvelope<TrendingMemeMarket[]>>('/market/trending', signal)
}
