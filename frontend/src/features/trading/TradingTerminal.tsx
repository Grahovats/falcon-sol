import { ArrowDownLeft, ArrowUpRight, ChevronDown, Clock3, Plus, SlidersHorizontal, TrendingUp, X } from 'lucide-react'
import { Component, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '../../api/client'
import { getMarketIcons, placeOrder, updatePositionExits } from '../../api/trading'
import { useCountdown } from '../../hooks/useCountdown'
import { useClock } from '../../hooks/useClock'
import { formatCurrency, formatPercent, formatPrice, formatToken } from '../../lib/format'
import type { Mission } from '../../types/mission'
import type { ExitLevels, LeaderboardRow, MarketPrice, OrderHistoryItem, OrderSide, Portfolio, Position } from '../../types/trading'
import { CommandBoard } from './CommandBoard'
import { PositionsTable } from './PositionsTable'
import { TradeHistory } from './TradeHistory'
import { ExitPriceInputs, PositionExitControls } from './PositionExitControls'
import { parseExitPrices } from './exit-prices'
import { TokenDiscovery } from './TokenDiscovery'
import { TokenIcon } from './TokenIcon'
import { ChartLoading } from './ChartLoading'
import './TerminalPolish.css'
// A distinct module URL lets retry recover from a cached failed dynamic import.
const retryChartModules = import.meta.glob<typeof import('./CandlestickChart')['CandlestickChart']>(
  './CandlestickChart.tsx', { query: '?retry', import: 'CandlestickChart' },
)
function loadCandlestickChart(retry = false) {
  return lazy(() => retry
    ? retryChartModules['./CandlestickChart.tsx']().then((Chart) => ({ default: Chart }))
    : import('./CandlestickChart').then((module) => ({ default: module.CandlestickChart })))
}
const POSITION_LIMIT_PERCENT = 30

interface TradingTerminalProps {
  cashEligibilityApproved?: boolean
  mission: Mission
  markets: MarketPrice[]
  portfolio: Portfolio
  leaderboard: LeaderboardRow[]
  leaderboardHidden: boolean
  leaderboardError?: string
  orders: OrderHistoryItem[]
  ordersError?: string
  onPortfolioUpdate: (portfolio: Portfolio) => void
  onOrderFilled: () => Promise<void>
  onMarketsChanged: () => Promise<void>
}

export function TradingTerminal({ cashEligibilityApproved = true, mission, markets, portfolio, leaderboard, leaderboardHidden, leaderboardError, orders, ordersError, onPortfolioUpdate, onOrderFilled, onMarketsChanged }: TradingTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    const syncAvailableHeight = () => {
      // Layout offsets stay stable while the route's entrance transform runs.
      let top = 0
      let element: HTMLElement | null = terminal
      while (element) { top += element.offsetTop; element = element.offsetParent as HTMLElement | null }
      terminal.style.setProperty('--terminal-top', `${top}px`)
    }
    const observer = new ResizeObserver(syncAvailableHeight)
    if (terminal.parentElement) observer.observe(terminal.parentElement)
    const header = document.querySelector('header')
    if (header) observer.observe(header)
    syncAvailableHeight()
    window.addEventListener('resize', syncAvailableHeight)
    return () => { observer.disconnect(); window.removeEventListener('resize', syncAvailableHeight) }
  }, [])

  const [selectedMarketId, setSelectedMarketId] = useState(() => mission.markets[0]?.id ?? '')
  const [orderSide, setOrderSide] = useState<OrderSide>('BUY')
  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const [activityView, setActivityView] = useState<'positions' | 'history'>('positions')
  const icons = useMarketIcons(mission.id, markets)
  const selectedMarket = markets.find((market) => market.marketId === selectedMarketId) ?? markets[0]
  const selectedPosition = portfolio.positions.find((position) => position.marketId === selectedMarket?.marketId)
  const rank = leaderboard.find((row) => row.userId === portfolio.userId)?.rank
  const admittedMints = useMemo(() => new Set(markets.map((market) => market.mintAddress)), [markets])

  function quickSell(marketId: string) {
    setSelectedMarketId(marketId)
    setOrderSide('SELL')
    document.getElementById('order-ticket')?.scrollIntoView({ block: 'center' })
  }

  return (
    <div ref={terminalRef} className="trading-terminal terminal-polished app-surface">
      <div className="terminal-grid">
        <MarketList icons={icons} missionProgress={<MissionProgress mission={mission} portfolio={portfolio} rank={rank} leaderboardHidden={leaderboardHidden} />} onDiscover={mission.allowDynamicMarkets ? () => setDiscoveryOpen(true) : undefined} markets={markets} positions={portfolio.positions} selectedMarketId={selectedMarket?.marketId ?? ''} onSelect={(id) => { setSelectedMarketId(id); setOrderSide('BUY') }} />
        <div className="terminal-main-column">
          <div className="app-surface terminal-chart min-w-0">
            {selectedMarket ? <MarketWorkspace key={selectedMarket.marketId} missionId={mission.id} market={selectedMarket} iconUrl={icons[selectedMarket.mintAddress]} quantity={selectedPosition?.quantity ?? '0'} averageEntryPrice={selectedPosition?.averageEntryPrice ?? '0'} unrealizedPnl={selectedPosition?.unrealizedPnl ?? '0'} position={selectedPosition} onExitChange={cashEligibilityApproved && selectedMarket.enabled && ['ACTIVE', 'BLACKOUT'].includes(mission.status) ? async (levels) => { const { data } = await updatePositionExits(mission.id, selectedMarket.marketId, levels); onPortfolioUpdate(data) } : undefined} /> : <div className="p-6 text-sm text-danger" role="alert">No current price is available for this mission.</div>}
          </div>
          <div className="terminal-blotter">
            <div className="terminal-activity-tabs" role="group" aria-label="Trading activity">
              <button type="button" aria-pressed={activityView === 'positions'} aria-controls="terminal-activity" onClick={() => setActivityView('positions')} className="focus-ring">Positions <span>{portfolio.positions.length}</span></button>
              <button type="button" aria-pressed={activityView === 'history'} aria-controls="terminal-activity" onClick={() => setActivityView('history')} className="focus-ring">Trade history <span>{orders.length}</span></button>
            </div>
            <div id="terminal-activity">
              {activityView === 'positions' ? <PositionsTable className="terminal-positions" missionId={mission.id} positions={portfolio.positions} enabledMarketIds={new Set(cashEligibilityApproved && ['ACTIVE', 'BLACKOUT'].includes(mission.status) ? markets.filter((market) => market.enabled).map((market) => market.marketId) : [])} onSell={quickSell} onPortfolioUpdate={onPortfolioUpdate} /> : <TradeHistory orders={orders} error={ordersError} />}
            </div>
          </div>
        </div>
        <div className="terminal-side-column">
          <aside className="app-surface terminal-order min-w-0" aria-label="Order entry">
            {selectedMarket && <OrderTicket key={selectedMarket.marketId} mission={mission} marketId={selectedMarket.marketId} symbol={selectedMarket.symbol} price={selectedMarket.currentPrice} cashEligibilityApproved={cashEligibilityApproved} enabled={selectedMarket.enabled} side={orderSide} onSideChange={setOrderSide} portfolio={portfolio} onPortfolioUpdate={onPortfolioUpdate} onOrderFilled={onOrderFilled} />}
            {selectedPosition && <details className="terminal-position-exits">
              <summary className="focus-ring">Manage {selectedPosition.symbol} exits <ChevronDown className="size-4" aria-hidden="true" /></summary>
              <PositionExitControls key={`${selectedPosition.marketId}:${selectedPosition.takeProfitPrice}:${selectedPosition.stopLossPrice}`} missionId={mission.id} position={selectedPosition} enabled={cashEligibilityApproved && Boolean(selectedMarket?.enabled) && ['ACTIVE', 'BLACKOUT'].includes(mission.status)} onPortfolioUpdate={onPortfolioUpdate} />
            </details>}
          </aside>
          <section className="terminal-performance" aria-labelledby="terminal-pnl-title">
            <div className="flex items-center justify-between gap-3"><h2 id="terminal-pnl-title">Your mission PnL</h2><TrendingUp className="size-4 text-muted" aria-hidden="true" /></div>
            <p className={`terminal-pnl-value ${Number(portfolio.totalPnl) >= 0 ? 'text-primary' : 'text-danger'}`}>{Number(portfolio.totalPnl) > 0 ? '+' : ''}{formatCurrency(portfolio.totalPnl)}</p>
            <p className="text-xs text-muted"><span className={Number(portfolio.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}>{formatPercent(portfolio.returnPercent)}</span> return</p>
          </section>
          <CommandBoard rows={leaderboard} currentUserId={portfolio.userId} hidden={leaderboardHidden} error={leaderboardError} />
        </div>
      </div>

      {mission.allowDynamicMarkets && discoveryOpen && <TokenDiscoveryModal onDismiss={() => setDiscoveryOpen(false)}>
        <TokenDiscovery missionId={mission.id} admittedMints={admittedMints} onAdmitted={async (marketId) => {
          await onMarketsChanged()
          setSelectedMarketId(marketId)
          setOrderSide('BUY')
          setDiscoveryOpen(false)
          document.getElementById('order-ticket')?.scrollIntoView({ block: 'center' })
        }} />
      </TokenDiscoveryModal>}

    </div>
  )
}

function MissionProgress({ mission, portfolio, rank, leaderboardHidden }: { mission: Mission; portfolio: Portfolio; rank?: number; leaderboardHidden: boolean }) {
  const countdown = useCountdown(mission.endsAt)
  const now = useClock()
  const startsAt = new Date(mission.startsAt).getTime()
  const endsAt = new Date(mission.endsAt).getTime()
  const elapsed = endsAt > startsAt ? Math.max(0, Math.min(100, (now - startsAt) / (endsAt - startsAt) * 100)) : 0

  return <section className="terminal-mission-progress" aria-label="Mission progress">
    <h1 className="sr-only">{mission.name}</h1>
    <div className="terminal-mission-clock"><span><Clock3 className="size-3.5" aria-hidden="true" /> Time left</span><strong>{countdown}</strong></div>
    <progress className="terminal-mission-time" aria-label="Mission time elapsed" value={elapsed} max={100} />
    <dl className="terminal-mission-stats">
      <div><dt>Virtual equity</dt><dd>{formatCurrency(portfolio.totalEquity)}</dd></div>
      <div><dt>Buying power</dt><dd>{formatCurrency(portfolio.cashBalance)}</dd></div>
      <div><dt>Return</dt><dd className={Number(portfolio.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}>{formatPercent(portfolio.returnPercent)}</dd></div>
      <div><dt>Your rank</dt><dd>{leaderboardHidden ? 'Hidden' : rank ? `#${rank}` : '—'}</dd></div>
    </dl>
  </section>
}

function MarketList({ markets, positions, selectedMarketId, onSelect, onDiscover, missionProgress, icons }: { icons: Record<string, string | null>; missionProgress: ReactNode; onDiscover?: () => void; markets: MarketPrice[]; positions: Portfolio['positions']; selectedMarketId: string; onSelect: (id: string) => void }) {
  return (
    <aside className="app-surface terminal-watch min-w-0" aria-labelledby="markets-title">
      <div className="terminal-panel-heading"><h2 id="markets-title">Market watch <span className="ml-1 font-mono text-xs font-normal text-muted">{markets.length}</span></h2></div>
      {onDiscover && <div className="terminal-watch-actions border-b border-line px-3 py-2"><button type="button" onClick={onDiscover} aria-haspopup="dialog" className="app-button focus-ring flex min-h-10 w-full items-center justify-center gap-2 rounded-sm border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary hover:border-primary/60 hover:bg-primary/15"><Plus className="size-4" aria-hidden="true" />Add coin</button></div>}

      <div className="terminal-market-list">
        {markets.map((market) => {
          const selected = market.marketId === selectedMarketId
          const held = positions.some((position) => position.marketId === market.marketId)
          return <button key={market.marketId} type="button" onClick={() => onSelect(market.marketId)} aria-pressed={selected} className={`app-button focus-ring terminal-market-row ${selected ? 'is-selected' : ''}`}>
            <TokenIcon key={market.mintAddress} symbol={market.symbol} iconUrl={icons[market.mintAddress]} />
            <span className="terminal-market-identity"><span className="flex min-w-0 items-center gap-2 font-semibold text-ink"><span className="truncate">{market.symbol}</span>{held && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Open position" />}</span>{!market.enabled && <span className="text-xs text-muted">Disabled</span>}</span>
            <span className="terminal-market-price"><span className="text-ink">{formatPrice(market.currentPrice)}</span><span className={`text-xs ${Number(market.changePercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(market.changePercent)}</span></span>
          </button>
        })}
      </div>
      {missionProgress}
    </aside>
  )
}

function TokenDiscoveryModal({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    dialog.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return <dialog ref={dialogRef} aria-labelledby="token-discovery-title" onCancel={(event) => { event.preventDefault(); onDismiss() }} onClick={(event) => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onDismiss()
  }} className="app-surface app-modal token-discovery-dialog token-search-dialog m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-[55rem] overflow-y-auto overscroll-contain bg-surface p-0 text-ink">
    <div className="token-search-header">
      <h2 id="token-discovery-title">Add coin</h2>
      <button type="button" onClick={onDismiss} aria-label="Close coin search" className="app-button focus-ring token-search-close"><X className="size-4" aria-hidden="true" /></button>
    </div>
    {children}
  </dialog>
}

function useMarketIcons(missionId: string, markets: MarketPrice[]) {
  const mintKey = markets.map(market => market.mintAddress).sort().join(',')
  const key = `${missionId}:${mintKey}`
  const [state, setState] = useState<{ key: string; icons: Record<string, string | null> }>()
  useEffect(() => {
    if (!mintKey) return
    const controller = new AbortController()
    void getMarketIcons(missionId, controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) setState({ key, icons: data })
    }).catch(() => { /* The letter badge remains available when metadata is offline. */ })
    return () => controller.abort()
  }, [missionId, mintKey, key])
  return state?.key === key ? state.icons : {}
}


function MarketWorkspace({ missionId, market, iconUrl, quantity, averageEntryPrice, unrealizedPnl, position, onExitChange }: { missionId: string; market: MarketPrice; iconUrl?: string | null; quantity: string; averageEntryPrice: string; unrealizedPnl: string; position?: Position; onExitChange?: (levels: ExitLevels) => Promise<void> }) {
  return (
    <section className="app-surface terminal-market-workspace overflow-hidden bg-surface">
      <div className="terminal-market-header">
        <div className="terminal-market-heading">
          <TokenIcon key={market.mintAddress} symbol={market.symbol} iconUrl={iconUrl} />
          <div>
          <h2 className="text-xl font-semibold text-ink">{market.symbol} <span className="font-mono text-xs font-normal text-muted">/ vUSDC</span></h2>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="font-mono text-2xl text-ink">{formatPrice(market.currentPrice)}</p>
            <span className={`font-mono text-sm ${Number(market.changePercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(market.changePercent)}</span>
          </div>
          </div>
        </div>
        <dl className="terminal-market-metrics flex flex-wrap gap-6 text-sm">
          <div><dt className="text-xs uppercase tracking-wider text-muted">Position</dt><dd className="mt-1 font-mono text-ink">{formatToken(quantity)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-muted">Avg entry</dt><dd className="mt-1 font-mono text-ink">{formatPrice(averageEntryPrice)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-muted">Unrealized</dt><dd className={`mt-1 font-mono ${Number(unrealizedPnl) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatCurrency(unrealizedPnl)}</dd></div>
        </dl>
      </div>
      <ChartErrorBoundary key={market.marketId} missionId={missionId} marketId={market.marketId} symbol={market.symbol} position={position} onExitChange={onExitChange} />
    </section>
  )
}

class ChartErrorBoundary extends Component<{ missionId: string; marketId: string; symbol: string; position?: Position; onExitChange?: (levels: ExitLevels) => Promise<void> }, { failed: boolean; Chart: ReturnType<typeof loadCandlestickChart> }> {
  state = { failed: false, Chart: loadCandlestickChart() }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <div className="flex min-h-80 flex-col items-center justify-center gap-3 border-t border-line px-6 text-center" role="alert">
        <p className="text-sm font-medium text-ink">Chart unavailable</p>
        <p className="max-w-md text-sm text-muted">The chart could not start. Retry to reconnect without leaving the terminal.</p>
        <button type="button" onClick={() => this.setState({ failed: false, Chart: loadCandlestickChart(true) })} className="app-button focus-ring min-h-10 border border-line px-4 text-sm text-ink hover:border-primary">Retry chart</button>
      </div>
    }
    const { Chart } = this.state
    return <Suspense fallback={<ChartLoading symbol={this.props.symbol} detail="Preparing chart" />}>
      <Chart missionId={this.props.missionId} marketId={this.props.marketId} symbol={this.props.symbol} position={this.props.position} onExitChange={this.props.onExitChange} />
    </Suspense>
  }
}

type OrderTicketProps = { cashEligibilityApproved: boolean; mission: Mission; marketId: string; symbol: string; price: string; enabled: boolean; side: OrderSide; onSideChange: (side: OrderSide) => void; portfolio: Portfolio; onPortfolioUpdate: (portfolio: Portfolio) => void; onOrderFilled: () => Promise<void> }

function OrderTicket(props: OrderTicketProps) {
  return <section id="order-ticket" className="app-surface terminal-ticket bg-surface">
    <div className="terminal-ticket-heading"><h2>Place order</h2></div>
    <div className="terminal-side-switch" data-side={props.side} role="group" aria-label="Order side">
      {(['BUY', 'SELL'] as const).map(value => <button key={value} type="button" onClick={() => props.onSideChange(value)} aria-pressed={props.side === value} className={`app-button focus-ring terminal-side-${value.toLowerCase()}`}>
        {value === 'BUY' ? <ArrowUpRight className="size-4" aria-hidden="true" /> : <ArrowDownLeft className="size-4" aria-hidden="true" />}<span>{value === 'BUY' ? 'Buy' : 'Sell'}</span>
      </button>)}
    </div>
    <OrderForm key={`${props.marketId}:${props.side}`} {...props} />
  </section>
}

function OrderForm({ cashEligibilityApproved, mission, marketId, symbol, price, enabled, side, portfolio, onPortfolioUpdate, onOrderFilled }: OrderTicketProps) {
  const [exitLevels, setExitLevels] = useState({ takeProfitPrice: '', stopLossPrice: '' })
  const [impactWarning, setImpactWarning] = useState<string | null>(null)
  const [amount, setAmount] = useState(''); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null)
  const position = portfolio.positions.find((item) => item.marketId === marketId)
  const maximum = useMemo(() => { if (side === 'SELL') return Number(position?.quantity ?? 0); const cap = Number(portfolio.startingBalance) * (POSITION_LIMIT_PERCENT / 100); const exposure = Number(position?.quantity ?? 0) * Number(price); return Math.max(0, Math.min(Number(portfolio.cashBalance), cap - exposure)) }, [portfolio.cashBalance, portfolio.startingBalance, position?.quantity, price, side])
  const tradingOpen = cashEligibilityApproved && (mission.status === 'ACTIVE' || mission.status === 'BLACKOUT') && enabled
  const allocationPercent = maximum > 0 && Number.isFinite(Number(amount)) ? Math.max(0, Math.min(100, Number(amount) / maximum * 100)) : 0
  function applyQuickValue(ratio: number) {
    const precision = side === 'BUY' ? 2 : 8
    const factor = 10 ** precision
    const value = Math.floor(maximum * ratio * factor) / factor
    setAmount(value.toFixed(precision).replace(/\.?0+$/, ''))
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !tradingOpen) return
    setError(null)
    setSuccess(null)
    let exits: ReturnType<typeof parseExitPrices> | undefined
    if (side === 'BUY') {
      try { exits = parseExitPrices(exitLevels, Number(price)) }
      catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Invalid exit prices.'); return }
    }
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(`Enter a valid ${side === 'BUY' ? 'virtual USDC amount' : `${symbol} quantity`}.`)
      return
    }
    if (numericAmount > maximum) {
      setError(side === 'BUY' ? `Only ${formatCurrency(maximum)} is currently available to buy.` : `Only ${formatToken(maximum)} ${symbol} is currently available to sell.`)
      return
    }
    const acceptHighPriceImpact = impactWarning !== null
    setImpactWarning(null)
    setSubmitting(true)
    try {
      const { data } = await placeOrder(mission.id, side === 'BUY'
        ? { marketId, side, notional: numericAmount, acceptHighPriceImpact,
            ...(exitLevels.takeProfitPrice.trim() ? { takeProfitPrice: exits?.takeProfitPrice } : {}),
            ...(exitLevels.stopLossPrice.trim() ? { stopLossPrice: exits?.stopLossPrice } : {}) }
        : { marketId, side, quantity: numericAmount, acceptHighPriceImpact })
      onPortfolioUpdate(data.portfolio)
      setSuccess(`${side} filled via ${data.fill.quoteProvider}${data.fill.quoteRouter ? `/${data.fill.quoteRouter}` : ''}: ${formatToken(data.fill.quantity)} ${symbol} at ${formatPrice(data.fill.executionPrice)}${data.fill.priceImpactPercent ? ` · ${Number(data.fill.priceImpactPercent).toFixed(3)}% impact` : ''}.`)
      setAmount('')
      setExitLevels({ takeProfitPrice: '', stopLossPrice: '' })
      await onOrderFilled()
    } catch (orderError: unknown) {
      if (orderError instanceof ApiError && orderError.code === 'PRICE_IMPACT_CONFIRMATION_REQUIRED') setImpactWarning(orderError.message)
      else setError(orderError instanceof Error ? orderError.message : 'Order could not be executed.')
    } finally { setSubmitting(false) }
  }
  const estimatedValue = Number(amount) > 0 && Number.isFinite(Number(amount)) && Number(price) > 0
    ? side === 'BUY' ? `${formatToken(Number(amount) / Number(price))} ${symbol}` : formatCurrency(Number(amount) * Number(price))
    : '—'

  return (
      <form className="terminal-order-form" data-side={side} onSubmit={submit} onChange={() => setImpactWarning(null)}>
        <div className="terminal-execution-type"><span>Market order</span><span>{symbol} / vUSDC</span></div>
        <div className="terminal-amount-card">
          <div className="flex items-center justify-between gap-2"><label htmlFor="order-amount">{side === 'BUY' ? 'Buy amount' : 'Sell amount'}</label><span className="terminal-currency-chip">{side === 'BUY' ? 'vUSDC' : symbol}</span></div>
          <div className="terminal-amount-input">
            {side === 'BUY' && <span className="terminal-amount-unit">$</span>}
            <input id="order-amount" disabled={submitting || !tradingOpen} type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'order-error order-help' : 'order-help'} placeholder="0.00" className="app-field app-field-embedded focus-ring" />
          </div>
          <div className="terminal-allocation-heading">
            <p id="order-help"><span>Available</span><strong>{side === 'BUY' ? formatCurrency(maximum) : `${formatToken(maximum)} ${symbol}`}</strong></p>
            <output htmlFor="order-allocation" aria-label="Allocation">{Math.round(allocationPercent)}<span>%</span></output>
          </div>
          <div className="terminal-allocation-control" style={{ '--allocation': `${allocationPercent}%` } as CSSProperties}>
            <input id="order-allocation" className="terminal-allocation-slider focus-ring" type="range" min="0" max="100" step="25" value={Math.round(allocationPercent)} onChange={event => applyQuickValue(Number(event.target.value) / 100)} aria-label={`Percentage of available ${side === 'BUY' ? 'virtual USDC' : symbol}`} aria-valuetext={`${Math.round(allocationPercent)} percent`} disabled={maximum <= 0 || submitting || !tradingOpen} />
            <div className="terminal-allocation-checkpoints" aria-hidden="true">{[0, 25, 50, 75, 100].map(percent => <span key={percent} data-reached={allocationPercent >= percent} style={{ left: `${percent}%` }} />)}</div>
          </div>
          <div className="terminal-allocation-labels" aria-hidden="true">{[0, 25, 50, 75, 100].map(percent => <span key={percent} data-reached={allocationPercent >= percent} style={{ left: `${percent}%` }}>{percent}%</span>)}</div>
        </div>
        {side === 'BUY' && <details className="terminal-optional-exits">
          <summary className="focus-ring"><span className="terminal-exits-title"><SlidersHorizontal className="size-3.5" aria-hidden="true" />Take profit / Stop loss</span><span className="terminal-exits-status">{exitLevels.takeProfitPrice.trim() || exitLevels.stopLossPrice.trim() ? `${Number(Boolean(exitLevels.takeProfitPrice.trim())) + Number(Boolean(exitLevels.stopLossPrice.trim()))} set` : 'Optional'}</span><ChevronDown className="size-3.5" aria-hidden="true" /></summary>
          <div className="terminal-exits-fields"><ExitPriceInputs levels={exitLevels} onChange={setExitLevels} disabled={submitting || !tradingOpen} placeholder="—" /></div>
        </details>}
        <dl className="terminal-order-estimate">
          <div><dt>Market price</dt><dd>{formatPrice(price)}</dd></div>
          <div><dt>{side === 'BUY' ? 'You receive ≈' : 'You receive ≈ vUSDC'}</dt><dd>{estimatedValue}</dd></div>
        </dl>
        {impactWarning && <div className="terminal-impact-warning" role="alert">
          <p>{impactWarning}</p>
          <button type="button" onClick={() => { setImpactWarning(null); document.getElementById('order-amount')?.focus() }} className="app-button focus-ring">Edit amount</button>
        </div>}
        {error && <p id="order-error" className="my-3 text-sm text-danger" role="alert">{error}</p>}
        {success && <p className="my-3 text-sm text-primary" role="status">{success}</p>}
        <button type="submit" disabled={submitting || !tradingOpen} aria-busy={submitting} className={`app-button focus-ring terminal-submit ${side === 'BUY' ? 'bg-primary text-primary-ink hover:bg-primary-strong' : 'bg-danger text-canvas'} disabled:cursor-not-allowed disabled:bg-line disabled:text-muted`}>
          {submitting ? 'Executing…' : !cashEligibilityApproved ? 'Eligibility pending' : !enabled ? 'Market disabled' : !tradingOpen ? 'Trading locked' : <>{side === 'BUY' ? <ArrowUpRight className="size-4" aria-hidden="true" /> : <ArrowDownLeft className="size-4" aria-hidden="true" />}{impactWarning ? 'Confirm high-impact' : side === 'BUY' ? 'Buy' : 'Sell'} {symbol}</>}
        </button>
      </form>
  )
}
