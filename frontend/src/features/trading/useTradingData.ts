import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { getLeaderboard, getMarkets, getOrders, getPortfolio } from '../../api/trading'
import { useAuth } from '../../providers/auth-context'
import type { LeaderboardResponse, MarketPrice, OrderHistoryItem, Portfolio } from '../../types/trading'

type Resource<T> = { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; message: string }
type PortfolioResource = Resource<Portfolio> | { status: 'not-joined' } | { status: 'authentication-required' }

export function useTradingData(missionId: string) {
  const auth = useAuth()
  const [markets, setMarkets] = useState<Resource<MarketPrice[]>>({ status: 'loading' })
  const [portfolio, setPortfolio] = useState<PortfolioResource>({ status: 'loading' })
  const [leaderboard, setLeaderboard] = useState<Resource<LeaderboardResponse>>({ status: 'loading' })
  const [orders, setOrders] = useState<Resource<OrderHistoryItem[]>>({ status: 'loading' })
  const portfolioMutation = useRef(0)
  const portfolioRequest = useRef(0)
  const lastAppliedPortfolioRequest = useRef(0)

  const refreshMarkets = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await getMarkets(missionId, signal)
      setMarkets({ status: 'success', data })
    } catch (error: unknown) {
      if (isAbort(error)) return
      setMarkets((current) => current.status === 'success' ? current : { status: 'error', message: messageFrom(error, 'Could not load market prices.') })
    }
  }, [missionId])

  const refreshPortfolio = useCallback(async (signal?: AbortSignal) => {
    if (auth.status !== 'authenticated') { setPortfolio({ status: 'authentication-required' }); return }
    const requestId = ++portfolioRequest.current
    const mutationAtRequest = portfolioMutation.current
    try {
      const { data } = await getPortfolio(missionId, signal)
      if (mutationAtRequest !== portfolioMutation.current || requestId < lastAppliedPortfolioRequest.current) return
      lastAppliedPortfolioRequest.current = requestId
      setPortfolio({ status: 'success', data })
    } catch (error: unknown) {
      if (isAbort(error)) return
      if (error instanceof ApiError && error.code === 'AUTHENTICATION_REQUIRED') {
        setPortfolio({ status: 'authentication-required' })
        return
      }
      if (error instanceof ApiError && error.code === 'MISSION_ENTRY_NOT_FOUND') {
        setPortfolio({ status: 'not-joined' })
        return
      }
      setPortfolio((current) => current.status === 'success' ? current : { status: 'error', message: messageFrom(error, 'Could not load portfolio.') })
    }
  }, [auth.status, missionId])

  const refreshLeaderboard = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await getLeaderboard(missionId, signal)
      setLeaderboard({ status: 'success', data: response })
    } catch (error: unknown) {
      if (isAbort(error)) return
      setLeaderboard((current) => current.status === 'success' ? current : { status: 'error', message: messageFrom(error, 'Could not load the command board.') })
    }
  }, [missionId])

  const refreshOrders = useCallback(async (signal?: AbortSignal) => {
    if (auth.status !== 'authenticated') { setOrders({ status: 'success', data: [] }); return }
    try {
      const { data } = await getOrders(missionId, signal)
      setOrders({ status: 'success', data })
    } catch (error: unknown) {
      if (isAbort(error)) return
      if (error instanceof ApiError && error.code === 'MISSION_ENTRY_NOT_FOUND') {
        setOrders({ status: 'success', data: [] })
        return
      }
      setOrders((current) => current.status === 'success' ? current : { status: 'error', message: messageFrom(error, 'Could not load order history.') })
    }
  }, [auth.status, missionId])

  const updatePortfolio = useCallback((data: Portfolio) => {
    // A polling request may have read the old balance before an order committed and
    // finish after this update. Invalidate those responses so they cannot restore
    // already-spent cash in the order ticket.
    portfolioMutation.current += 1
    setPortfolio({ status: 'success', data })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const initialLoad = window.setTimeout(() => {
      void refreshMarkets(controller.signal)
      void refreshPortfolio(controller.signal)
      void refreshLeaderboard(controller.signal)
      void refreshOrders(controller.signal)
    }, 0)
    const priceInterval = window.setInterval(() => void refreshMarkets(controller.signal), 10_000)
    const portfolioInterval = window.setInterval(() => void refreshPortfolio(controller.signal), 10_000)
    const leaderboardInterval = window.setInterval(() => void refreshLeaderboard(controller.signal), 10_000)
    const orderInterval = window.setInterval(() => void refreshOrders(controller.signal), 10_000)
    return () => {
      controller.abort()
      window.clearTimeout(initialLoad)
      window.clearInterval(priceInterval)
      window.clearInterval(portfolioInterval)
      window.clearInterval(leaderboardInterval)
      window.clearInterval(orderInterval)
    }
  }, [refreshLeaderboard, refreshMarkets, refreshOrders, refreshPortfolio])

  return { markets, portfolio, leaderboard, orders, refreshMarkets, refreshPortfolio, refreshLeaderboard, refreshOrders, updatePortfolio }
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
