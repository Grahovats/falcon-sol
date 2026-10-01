import type { ApiEnvelope } from '../types/mission'
import type { LeaderboardResponse, MarketPrice, OrderExecution, OrderHistoryItem, OrderRequest, Portfolio } from '../types/trading'
import { apiGet, apiPost } from './client'

export function joinMission(missionId: string) {
  return apiPost<ApiEnvelope<{ id: string }>>(`/missions/${encodeURIComponent(missionId)}/join`)
}

export function getMarkets(missionId: string, signal?: AbortSignal) {
  return apiGet<ApiEnvelope<MarketPrice[]>>(`/missions/${encodeURIComponent(missionId)}/markets`, signal)
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
