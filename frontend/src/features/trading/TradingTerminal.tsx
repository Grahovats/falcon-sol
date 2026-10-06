import { Activity, Clock3, Search, TrendingUp, WalletCards, X } from 'lucide-react'
import { Component, lazy, Suspense, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { placeOrder } from '../../api/trading'
import { useCountdown } from '../../hooks/useCountdown'
import { formatCurrency, formatPercent, formatPrice, formatToken } from '../../lib/format'
import type { Mission } from '../../types/mission'
import type { LeaderboardRow, MarketPrice, OrderHistoryItem, OrderSide, Portfolio } from '../../types/trading'
import { StatusBadge } from '../missions/StatusBadge'
import { CommandBoard } from './CommandBoard'
import { PositionsTable } from './PositionsTable'
import { TradeHistory } from './TradeHistory'
import { TokenDiscovery } from './TokenDiscovery'
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

export function TradingTerminal({ mission, markets, portfolio, leaderboard, leaderboardHidden, leaderboardError, orders, ordersError, onPortfolioUpdate, onOrderFilled, onMarketsChanged }: TradingTerminalProps) {
  const [selectedMarketId, setSelectedMarketId] = useState(() => mission.markets[0]?.id ?? '')
  const [orderSide, setOrderSide] = useState<OrderSide>('BUY')
  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const selectedMarket = markets.find((market) => market.marketId === selectedMarketId) ?? markets[0]
  const selectedPosition = portfolio.positions.find((position) => position.marketId === selectedMarket?.marketId)
  const countdown = useCountdown(mission.endsAt)
  const rank = leaderboard.find((row) => row.userId === portfolio.userId)?.rank
  const admittedMints = useMemo(() => new Set(markets.map((market) => market.mintAddress)), [markets])

  function quickSell(marketId: string) {
    setSelectedMarketId(marketId)
    setOrderSide('SELL')
    document.getElementById('order-ticket')?.scrollIntoView({ block: 'center' })
  }

  return (
    <div className="trading-terminal space-y-3">
      <section className="border border-line bg-surface px-4 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="min-w-52 flex-1"><p className="mb-1 font-mono text-xs uppercase tracking-widest text-muted">Trading terminal</p><div className="flex items-center gap-3"><h1 className="text-base font-semibold text-ink">{mission.name}</h1><StatusBadge status={mission.status} /></div></div>
          <Metric label="Time remaining" value={countdown} icon={<Clock3 className="size-4" aria-hidden="true" />} />
          <Metric label="Virtual equity" value={formatCurrency(portfolio.totalEquity)} icon={<Activity className="size-4" aria-hidden="true" />} />
          <Metric label="Buying power" value={`${formatCurrency(portfolio.cashBalance)} vUSDC`} icon={<WalletCards className="size-4" aria-hidden="true" />} />
          <Metric label="Total return" value={formatPercent(portfolio.returnPercent)} positive={Number(portfolio.returnPercent) >= 0} icon={<TrendingUp className="size-4" aria-hidden="true" />} />
          <Metric label="Current rank" value={leaderboardHidden ? 'HIDDEN' : rank ? `#${rank}` : '—'} />
        </div>
      </section>

      {mission.allowDynamicMarkets && discoveryOpen && <div id="token-discovery-panel" className="relative"><button type="button" aria-label="Close coin search" onClick={() => setDiscoveryOpen(false)} className="focus-ring absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-md text-muted hover:bg-surface-raised hover:text-ink"><X className="size-4" aria-hidden="true" /></button><TokenDiscovery missionId={mission.id} admittedMints={admittedMints} onAdmitted={async (marketId) => { await onMarketsChanged(); setSelectedMarketId(marketId); setOrderSide('BUY'); setDiscoveryOpen(false); document.getElementById('order-ticket')?.scrollIntoView({ block: 'center' }) }} /></div>}

      <div className="terminal-grid">
        <MarketList onDiscover={mission.allowDynamicMarkets ? () => setDiscoveryOpen((open) => !open) : undefined} discoveryOpen={discoveryOpen} markets={markets} positions={portfolio.positions} selectedMarketId={selectedMarket?.marketId ?? ''} onSelect={(id) => { setSelectedMarketId(id); setOrderSide('BUY') }} />
        <div className="terminal-chart min-w-0">
          {selectedMarket ? <MarketWorkspace key={selectedMarket.marketId} missionId={mission.id} market={selectedMarket} quantity={selectedPosition?.quantity ?? '0'} averageEntryPrice={selectedPosition?.averageEntryPrice ?? '0'} unrealizedPnl={selectedPosition?.unrealizedPnl ?? '0'} /> : <div className="p-6 text-sm text-danger" role="alert">No current price is available for this mission.</div>}
        </div>
        <aside className="terminal-order min-w-0" aria-label="Order entry and rankings">
          {selectedMarket && <OrderTicket key={`${selectedMarket.marketId}:${orderSide}`} mission={mission} marketId={selectedMarket.marketId} symbol={selectedMarket.symbol} price={selectedMarket.currentPrice} enabled={selectedMarket.enabled} side={orderSide} onSideChange={setOrderSide} portfolio={portfolio} onPortfolioUpdate={onPortfolioUpdate} onOrderFilled={onOrderFilled} />}
          <CommandBoard rows={leaderboard} currentUserId={portfolio.userId} hidden={leaderboardHidden} error={leaderboardError} />
        </aside>
      </div>

      <PositionsTable positions={portfolio.positions} onSell={quickSell} />
      <TradeHistory orders={orders} error={ordersError} />
    </div>
  )
}

function Metric({ label, value, icon, positive }: { label: string; value: string; icon?: ReactNode; positive?: boolean }) {
  return <dl className="min-w-28 border-l border-line pl-4"><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">{icon}{label}</dt><dd className={`mt-1 font-mono text-sm tabular-nums ${positive === undefined ? 'text-ink' : positive ? 'text-primary' : 'text-danger'}`}>{value}</dd></dl>
}

function MarketList({ markets, positions, selectedMarketId, onSelect, onDiscover, discoveryOpen }: { onDiscover?: () => void; discoveryOpen: boolean; markets: MarketPrice[]; positions: Portfolio['positions']; selectedMarketId: string; onSelect: (id: string) => void }) {
  return (
    <aside className="terminal-watch min-w-0" aria-labelledby="markets-title">
      <div className="terminal-panel-heading"><h2 id="markets-title">Market watch <span className="ml-1 font-mono text-xs font-normal text-muted">{markets.length}</span></h2></div>
      {onDiscover && <div className="border-b border-line p-3"><button type="button" onClick={onDiscover} aria-expanded={discoveryOpen} aria-controls={discoveryOpen ? 'token-discovery-panel' : undefined} className="focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary hover:border-primary hover:bg-primary/10"><Search className="size-4" aria-hidden="true" />Find &amp; add coin</button></div>}
      <div className="flex justify-between border-b border-line px-4 py-2 font-mono text-xs text-muted"><span>Asset / Price</span><span>Change</span></div>
      <div className="terminal-market-list">
        {markets.map((market) => {
          const selected = market.marketId === selectedMarketId
          const held = positions.some((position) => position.marketId === market.marketId)
          return <button key={market.marketId} type="button" onClick={() => onSelect(market.marketId)} aria-pressed={selected} className={`focus-ring terminal-market-row ${selected ? 'is-selected' : ''}`}>
            <span className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 font-semibold text-ink"><span className="truncate">{market.symbol}</span>{held && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Open position" />}</span><span className={`font-mono text-xs ${Number(market.changePercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(market.changePercent)}</span></span>
            <span className="mt-1 flex items-center justify-between font-mono text-xs text-muted"><span>{formatPrice(market.currentPrice)}</span><span>{!market.enabled ? 'Disabled' : selected ? 'Selected' : 'vUSDC'}</span></span>
          </button>
        })}
      </div>
      <p className="border-t border-line px-4 py-3 text-xs leading-5 text-muted">Select an asset to view its chart and trade.</p>
    </aside>
  )
}

function MarketWorkspace({ missionId, market, quantity, averageEntryPrice, unrealizedPnl }: { missionId: string; market: MarketPrice; quantity: string; averageEntryPrice: string; unrealizedPnl: string }) {
  return (
    <section className="overflow-hidden bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">{market.symbol} <span className="font-mono text-xs font-normal text-muted">/ vUSDC</span></h2>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="font-mono text-2xl text-ink">{formatPrice(market.currentPrice)}</p>
            <span className={`font-mono text-sm ${Number(market.changePercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(market.changePercent)}</span>
          </div>
        </div>
        <dl className="flex flex-wrap gap-6 text-sm">
          <div><dt className="text-xs uppercase tracking-wider text-muted">Position</dt><dd className="mt-1 font-mono text-ink">{formatToken(quantity)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-muted">Avg entry</dt><dd className="mt-1 font-mono text-ink">{formatPrice(averageEntryPrice)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-muted">Unrealized</dt><dd className={`mt-1 font-mono ${Number(unrealizedPnl) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatCurrency(unrealizedPnl)}</dd></div>
        </dl>
      </div>
      <ChartErrorBoundary key={market.marketId} missionId={missionId} marketId={market.marketId} symbol={market.symbol} />
    </section>
  )
}

class ChartErrorBoundary extends Component<{ missionId: string; marketId: string; symbol: string }, { failed: boolean; Chart: ReturnType<typeof loadCandlestickChart> }> {
  state = { failed: false, Chart: loadCandlestickChart() }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <div className="flex min-h-80 flex-col items-center justify-center gap-3 border-t border-line px-6 text-center" role="alert">
        <p className="text-sm font-medium text-ink">Chart unavailable</p>
        <p className="max-w-md text-sm text-muted">The chart could not start. Retry to reconnect without leaving the terminal.</p>
        <button type="button" onClick={() => this.setState({ failed: false, Chart: loadCandlestickChart(true) })} className="focus-ring min-h-10 border border-line px-4 text-sm text-ink hover:border-primary">Retry chart</button>
      </div>
    }
    const { Chart } = this.state
    return <Suspense fallback={<div className="terminal-chart-canvas animate-pulse border-t border-line bg-canvas/40" aria-busy="true" aria-label="Loading candlestick chart" />}>
      <Chart missionId={this.props.missionId} marketId={this.props.marketId} symbol={this.props.symbol} />
    </Suspense>
  }
}

function OrderTicket({ mission, marketId, symbol, price, enabled, side, onSideChange, portfolio, onPortfolioUpdate, onOrderFilled }: { mission: Mission; marketId: string; symbol: string; price: string; enabled: boolean; side: OrderSide; onSideChange: (side: OrderSide) => void; portfolio: Portfolio; onPortfolioUpdate: (portfolio: Portfolio) => void; onOrderFilled: () => Promise<void> }) {
  const [amount, setAmount] = useState(''); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null)
  const position = portfolio.positions.find((item) => item.marketId === marketId)
  const maximum = useMemo(() => { if (side === 'SELL') return Number(position?.quantity ?? 0); const cap = Number(portfolio.startingBalance) * (POSITION_LIMIT_PERCENT / 100); const exposure = Number(position?.quantity ?? 0) * Number(price); return Math.max(0, Math.min(Number(portfolio.cashBalance), cap - exposure)) }, [portfolio.cashBalance, portfolio.startingBalance, position?.quantity, price, side])
  const tradingOpen = (mission.status === 'ACTIVE' || mission.status === 'BLACKOUT') && enabled
  function selectSide(value: OrderSide) { onSideChange(value); setAmount(''); setError(null); setSuccess(null) }
  function applyQuickValue(ratio: number) { setAmount((maximum * ratio).toFixed(side === 'BUY' ? 2 : 8).replace(/\.?0+$/, '')) }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); setSuccess(null); const numericAmount = Number(amount); if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError(`Enter a valid ${side === 'BUY' ? 'virtual USDC amount' : `${symbol} quantity`}.`); return } if (numericAmount > maximum) { setError(side === 'BUY' ? `Only ${formatCurrency(maximum)} is currently available to buy.` : `Only ${formatToken(maximum)} ${symbol} is currently available to sell.`); return } setSubmitting(true); try { const { data } = await placeOrder(mission.id, side === 'BUY' ? { marketId, side, notional: numericAmount } : { marketId, side, quantity: numericAmount }); onPortfolioUpdate(data.portfolio); setSuccess(`${side} filled via ${data.fill.quoteProvider}${data.fill.quoteRouter ? `/${data.fill.quoteRouter}` : ''}: ${formatToken(data.fill.quantity)} ${symbol} at ${formatPrice(data.fill.executionPrice)}${data.fill.priceImpactPercent ? ` · ${Number(data.fill.priceImpactPercent).toFixed(3)}% impact` : ''}.`); setAmount(''); await onOrderFilled() } catch (orderError: unknown) { setError(orderError instanceof Error ? orderError.message : 'Order could not be executed.') } finally { setSubmitting(false) } }
  return <section id="order-ticket" className="bg-surface p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-ink">Place order</h2><span className="font-mono text-xs text-muted">{symbol} / vUSDC</span></div><div className="grid grid-cols-2 gap-1 rounded-sm bg-canvas p-1" aria-label="Order side">{(['BUY', 'SELL'] as const).map((value) => <button key={value} type="button" onClick={() => selectSide(value)} aria-pressed={side === value} className={`focus-ring min-h-11 border text-sm font-semibold ${side === value ? value === 'BUY' ? 'border-primary/40 bg-primary/15 text-primary' : 'border-danger/40 bg-danger/15 text-danger' : 'border-line text-muted hover:text-ink'}`}>{value}</button>)}</div><form className="mt-5" onSubmit={submit}><div className="mb-5 flex items-center justify-between border-b border-line pb-3 text-xs"><span className="font-medium text-ink">Market order</span><span className="text-muted">Paper trading</span></div><label htmlFor="order-amount" className="text-sm font-medium text-ink">{side === 'BUY' ? 'Amount (virtual USDC)' : `Quantity (${symbol})`}</label><div className="mt-2 flex border border-line bg-canvas focus-within:border-primary"><input id="order-amount" type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'order-error' : 'order-help'} placeholder="0.00" className="min-h-12 min-w-0 flex-1 bg-transparent px-3 font-mono text-xl text-ink focus:outline-none" /><span className="grid place-items-center px-3 font-mono text-xs text-muted">{side === 'BUY' ? 'vUSDC' : symbol}</span></div><p id="order-help" className="mt-2 text-xs text-muted">{side === 'BUY' ? `Max per coin: ${POSITION_LIMIT_PERCENT}% of starting capital · Available for ${symbol}: ${formatCurrency(maximum)} · Minimum $100` : `Available to sell: ${formatToken(maximum)} ${symbol}`}</p><div className="mt-4 grid grid-cols-4 gap-2">{[0.1, 0.25, 0.5, 1].map((ratio) => <button key={ratio} type="button" onClick={() => applyQuickValue(ratio)} className="focus-ring min-h-10 border border-line font-mono text-xs text-muted hover:border-primary hover:text-ink">{ratio === 1 ? 'MAX' : `${ratio * 100}%`}</button>)}</div><dl className="mt-5 space-y-3 border-y border-line py-4 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted">Market price</dt><dd className="font-mono text-ink">{formatPrice(price)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted">{side === 'BUY' ? 'Estimated quantity' : 'Estimated proceeds'}</dt><dd className="font-mono text-ink">{Number(amount) > 0 && Number.isFinite(Number(amount)) && Number(price) > 0 ? side === 'BUY' ? `${formatToken(Number(amount) / Number(price))} ${symbol}` : formatCurrency(Number(amount) * Number(price)) : '—'}</dd></div></dl>{error && <p id="order-error" className="mt-4 text-sm text-danger" role="alert">{error}</p>}{success && <p className="mt-4 text-sm text-primary" role="status">{success}</p>}<button type="submit" disabled={submitting || !tradingOpen} aria-busy={submitting} className={`focus-ring mt-5 min-h-12 w-full text-sm font-semibold ${side === 'BUY' ? 'bg-primary text-primary-ink hover:bg-primary-strong' : 'bg-danger text-canvas'} disabled:cursor-not-allowed disabled:bg-line disabled:text-muted`}>{submitting ? 'Executing…' : !enabled ? 'Market disabled' : !tradingOpen ? 'Trading locked' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${symbol}`}</button><p className="mt-3 text-center text-xs leading-5 text-muted">Executed at the available quote. Final fill may vary.</p></form></section>
}
