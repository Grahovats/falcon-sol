import { useEffect, useMemo, useState } from 'react'
import { getTrendingMemeMarkets, type TrendingMemeMarket } from '../api/market'
import { formatPercent, formatPrice } from '../lib/format'

type TapeState =
  | { status: 'loading'; markets: TrendingMemeMarket[] }
  | { status: 'success'; markets: TrendingMemeMarket[] }
  | { status: 'error'; markets: TrendingMemeMarket[] }

export function MarketTape() {
  const [state, setState] = useState<TapeState>({ status: 'loading', markets: [] })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await getTrendingMemeMarkets(controller.signal)
        setState({ status: 'success', markets: response.data.slice(0, 10) })
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState((current) => ({ status: 'error', markets: current.markets }))
      }
    }

    void load()
    const interval = window.setInterval(() => void load(), 60_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [])

  const tape = useMemo(() => {
    if (state.markets.length === 0) return []
    const itemsPerHalf = Math.max(30, state.markets.length)
    const firstHalf = Array.from({ length: itemsPerHalf }, (_, index) => state.markets[index % state.markets.length])
    return [...firstHalf, ...firstHalf]
  }, [state.markets])

  return (
    <section className="market-tape" aria-label="Top 10 trending Solana meme coins">
      <div className="flex min-h-9 items-stretch">
        <div className="market-tape-window min-w-0 flex-1">
          {tape.length > 0 ? (
            <ul className="market-tape-track" aria-label="Live trending meme-coin prices from GeckoTerminal">
              {tape.map((market, index) => {
                const change = Number(market.changePercent)
                const rank = (index % state.markets.length) + 1
                return (
                  <li key={`${market.marketId}-${index}`} className="flex shrink-0 items-center gap-3 border-r border-line/70 px-5 font-mono text-xs tabular-nums" aria-hidden={index >= state.markets.length}>
                    <span className="text-muted">#{rank}</span>
                    <span className="font-semibold text-ink">{market.symbol}</span>
                    <span className="text-muted">{formatPrice(market.currentPrice)}</span>
                    <span className={change >= 0 ? 'text-primary' : 'text-danger'}>{formatPercent(change)}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex min-h-9 items-center px-5 font-mono text-xs text-muted" role={state.status === 'error' ? 'alert' : 'status'}>
              {state.status === 'error' ? 'Trending meme feed unavailable' : 'Scanning trending meme markets…'}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
