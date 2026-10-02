import { useEffect, useMemo, useState } from 'react'
import { getMissions } from '../api/missions'
import { getMarkets } from '../api/trading'
import { formatPercent, formatPrice } from '../lib/format'
import type { MarketPrice } from '../types/trading'

const fallbackMarkets: MarketPrice[] = [
  { marketId: 'bonk', symbol: 'BONK', mintAddress: '', enabled: true, currentPrice: '0.00001942', changePercent: '8.74', asOf: '', source: 'mock', history: [] },
  { marketId: 'wif', symbol: 'WIF', mintAddress: '', enabled: true, currentPrice: '2.18', changePercent: '-2.31', asOf: '', source: 'mock', history: [] },
  { marketId: 'popcat', symbol: 'POPCAT', mintAddress: '', enabled: true, currentPrice: '0.7421', changePercent: '12.46', asOf: '', source: 'mock', history: [] },
  { marketId: 'pnut', symbol: 'PNUT', mintAddress: '', enabled: true, currentPrice: '0.2147', changePercent: '4.18', asOf: '', source: 'mock', history: [] },
  { marketId: 'mew', symbol: 'MEW', mintAddress: '', enabled: true, currentPrice: '0.003814', changePercent: '-1.08', asOf: '', source: 'mock', history: [] },
  { marketId: 'fartcoin', symbol: 'FARTCOIN', mintAddress: '', enabled: true, currentPrice: '0.8642', changePercent: '6.92', asOf: '', source: 'mock', history: [] },
]

export function MarketTape() {
  const [markets, setMarkets] = useState<MarketPrice[]>(fallbackMarkets)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const missionResponse = await getMissions(controller.signal)
        const mission = missionResponse.data.find((item) => ['ACTIVE', 'BLACKOUT'].includes(item.status) && item.marketCount > 0)
          ?? missionResponse.data.find((item) => item.marketCount > 0)
        if (!mission) return
        const marketResponse = await getMarkets(mission.id, controller.signal)
        if (marketResponse.data.length > 0) {
          setMarkets(marketResponse.data.slice(0, 10))
          setLive(true)
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLive(false)
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
    const itemsPerHalf = Math.max(32, markets.length)
    const firstHalf = Array.from({ length: itemsPerHalf }, (_, index) => markets[index % markets.length])
    return { items: [...firstHalf, ...firstHalf], halfLength: firstHalf.length }
  }, [markets])

  return (
    <section className="market-tape border-t border-line/70 bg-surface-muted" aria-label="Meme coin market tape">
      <div className="flex min-h-9 items-stretch">
        <div className="market-tape-window min-w-0 flex-1">
          <ul className="market-tape-track" aria-label={live ? 'Live mission prices' : 'Illustrative paper-market prices'}>
            {tape.items.map((market, index) => {
              const change = Number(market.changePercent)
              return (
                <li key={`${market.marketId}-${index}`} className="flex shrink-0 items-center gap-3 border-r border-line/70 px-5 font-mono text-xs tabular-nums" aria-hidden={index >= markets.length || index >= tape.halfLength}>
                  <span className="font-semibold text-ink">{market.symbol}</span>
                  <span className="text-muted">{formatPrice(market.currentPrice)}</span>
                  <span className={change >= 0 ? 'text-primary' : 'text-danger'}>{formatPercent(change)}</span>
                </li>
              )
            })}
          </ul>
        </div>

      </div>
    </section>
  )
}
