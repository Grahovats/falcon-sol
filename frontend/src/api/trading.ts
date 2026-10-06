import type { ApiEnvelope } from '../types/mission'
import type { AdmittedMarket, CandleResponse, CandleTimeframe, LeaderboardResponse, MarketPrice, OrderExecution, OrderHistoryItem, OrderRequest, ExitLevels, Portfolio, TokenCandidate } from '../types/trading'
import { apiGet, apiPatch, apiPost } from './client'

export function joinMission(missionId: string) {
  return apiPost<ApiEnvelope<{ id: string }>>(`/missions/${encodeURIComponent(missionId)}/join`)
}

export function getMarkets(missionId: string, signal?: AbortSignal) {
  return apiGet<ApiEnvelope<MarketPrice[]>>(`/missions/${encodeURIComponent(missionId)}/markets`, signal)
}

export function discoverTokens(missionId: string, input: { query: string } | { feed: 'recent' }, signal?: AbortSignal) {
  const params = new URLSearchParams(input)
  return apiGet<ApiEnvelope<TokenCandidate[]>>(`/missions/${encodeURIComponent(missionId)}/token-discovery?${params.toString()}`, signal)
}

export function admitToken(missionId: string, mintAddress: string) {
  return apiPost<ApiEnvelope<AdmittedMarket>>(`/missions/${encodeURIComponent(missionId)}/markets/admit`, { mintAddress })
}

export function getCandles(missionId: string, marketId: string, timeframe: CandleTimeframe, signal?: AbortSignal) {
  return apiGet<CandleResponse>(`/missions/${encodeURIComponent(missionId)}/markets/${encodeURIComponent(marketId)}/candles?timeframe=${timeframe}`, signal)
}

export function getPortfolio(missionId: string, signal?: AbortSignal) {
  return apiGet<ApiEnvelope<Portfolio>>(`/missions/${encodeURIComponent(missionId)}/portfolio`, signal)
}

export function getLeaderboard(missionId: string, signal?: AbortSignal) {
  return apiGet<LeaderboardResponse>(`/missions/${encodeURIComponent(missionId)}/leaderboard`, signal)
}

export function getOrders(missionId: string, signal?: AbortSignal) {
  return apiGet<ApiEnvelope<OrderHistoryItem[]>>(`/missions/${encodeURIComponent(missionId)}/orders`, signal)
}

export function placeOrder(missionId: string, order: OrderRequest) {
  return apiPost<ApiEnvelope<OrderExecution>>(`/missions/${encodeURIComponent(missionId)}/orders`, order)
}

export function updatePositionExits(missionId: string, marketId: string, levels: ExitLevels) {
  return apiPatch<ApiEnvelope<Portfolio>>(`/missions/${encodeURIComponent(missionId)}/markets/${encodeURIComponent(marketId)}/exits`, levels)
}
