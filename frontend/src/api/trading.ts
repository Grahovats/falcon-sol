import type { ApiEnvelope, CashEntryInput } from '../types/mission'
import type { AdmittedMarket, CandleResponse, CandleTimeframe, LeaderboardResponse, MarketPrice, OrderExecution, OrderHistoryItem, OrderRequest, ExitLevels, Portfolio, TokenCandidate } from '../types/trading'
import { ApiError, apiGet, apiPatch, apiPost } from './client'

export function joinMission(missionId: string, input?: CashEntryInput) {
  return apiPost<ApiEnvelope<{ id: string }>>(`/missions/${encodeURIComponent(missionId)}/join`, input)
}

export function getMarkets(missionId: string, signal?: AbortSignal) {
  return apiGet<ApiEnvelope<MarketPrice[]>>(`/missions/${encodeURIComponent(missionId)}/markets`, signal)
}

export function getMarketIcons(missionId: string, signal?: AbortSignal) {
  return apiGet<ApiEnvelope<Record<string, string | null>>>(`/missions/${encodeURIComponent(missionId)}/market-icons`, signal)
}

export function discoverTokens(missionId: string, input: { query: string } | { feed: 'recent' }, signal?: AbortSignal) {
  const params = new URLSearchParams(input)
  return apiGet<ApiEnvelope<TokenCandidate[]>>(`/missions/${encodeURIComponent(missionId)}/token-discovery?${params.toString()}`, signal)
}

export function admitToken(missionId: string, mintAddress: string) {
  return apiPost<ApiEnvelope<AdmittedMarket>>(`/missions/${encodeURIComponent(missionId)}/markets/admit`, { mintAddress })
}

const candleCache = new Map<string, { response: CandleResponse; cachedAt: number }>()
const pendingCandles = new Map<string, Promise<CandleResponse>>()
let chartCooldownUntil = 0

export async function getCandles(missionId: string, marketId: string, timeframe: CandleTimeframe, signal?: AbortSignal, before?: number) {
  signal?.throwIfAborted()
  const query = new URLSearchParams({ timeframe })
  if (before !== undefined) query.set('before', String(before))
  const path = `/missions/${encodeURIComponent(missionId)}/markets/${encodeURIComponent(marketId)}/candles?${query}`
  const cached = candleCache.get(path)
  const ttl = before === undefined ? 60_000 : 60 * 60_000
  if (cached && Date.now() - cached.cachedAt < ttl) return cached.response
  const fallback = cached && Date.now() - cached.response.meta.fetchedAt < 10 * 60_000
    ? { ...cached.response, meta: { ...cached.response.meta, stale: true } } : null
  if (chartCooldownUntil > Date.now()) {
    if (fallback) return fallback
    throw new ApiError('Chart provider is temporarily limiting requests. Please wait for the cooldown.', 429, 'CANDLE_DATA_UNAVAILABLE', Math.ceil((chartCooldownUntil - Date.now()) / 1000))
  }
  let request = pendingCandles.get(path)
  if (!request) {
    // Share in-flight requests across remounts; aborting a view must not cancel
    // the same request another view is awaiting.
    request = apiGet<CandleResponse>(path).then(response => {
      if (candleCache.size >= 100) candleCache.delete(candleCache.keys().next().value!)
      candleCache.set(path, { response, cachedAt: Date.now() })
      return response
    }).catch(error => {
      if (error instanceof ApiError && error.status === 429) chartCooldownUntil = Date.now() + (error.retryAfterSeconds ?? 60) * 1000
      if (fallback) return fallback
      throw error
    }).finally(() => pendingCandles.delete(path))
    pendingCandles.set(path, request)
  }
  const response = await request
  signal?.throwIfAborted()
  return response
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
