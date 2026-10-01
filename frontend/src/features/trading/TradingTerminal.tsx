import { Activity, Clock3, TrendingUp } from 'lucide-react'
import { lazy, Suspense, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { placeOrder } from '../../api/trading'
import { useCountdown } from '../../hooks/useCountdown'
import { formatCurrency, formatPercent, formatPrice, formatToken } from '../../lib/format'
import type { Mission } from '../../types/mission'
import type { LeaderboardRow, MarketPrice, OrderHistoryItem, OrderSide, Portfolio } from '../../types/trading'
import { StatusBadge } from '../missions/StatusBadge'
import { CommandBoard } from './CommandBoard'
import { PositionsTable } from './PositionsTable'
import { TradeHistory } from './TradeHistory'
const CandlestickChart = lazy(() => import('./CandlestickChart').then((module) => ({ default: module.CandlestickChart })))

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
}

export function TradingTerminal({ mission, markets, portfolio, leaderboard, leaderboardHidden, leaderboardError, orders, ordersError, onPortfolioUpdate, onOrderFilled }: TradingTerminalProps) {
  const [selectedMarketId, setSelectedMarketId] = useState(() => mission.markets[0]?.id ?? '')
  const [orderSide, setOrderSide] = useState<OrderSide>('BUY')
  const selectedMarket = markets.find((market) => market.marketId === selectedMarketId) ?? markets[0]
  const selectedPosition = portfolio.positions.find((position) => position.marketId === selectedMarket?.marketId)
  const countdown = useCountdown(mission.endsAt)
  const rank = leaderboard.find((row) => row.userId === portfolio.userId)?.rank

  function quickSell(marketId: string) {
    setSelectedMarketId(marketId)
    setOrderSide('SELL')
    document.getElementById('order-ticket')?.scrollIntoView({ block: 'center' })
  }

  return (
    <div className="space-y-4">
      <section className="border border-line bg-surface px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="min-w-52 flex-1"><div className="flex items-center gap-3"><h1 className="text-lg font-semibold text-ink">{mission.name}</h1><StatusBadge status={mission.status} /></div><p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">Live paper-trading terminal</p></div>
          <Metric label="Time remaining" value={countdown} icon={<Clock3 className="size-4" aria-hidden="true" />} />
          <Metric label="Virtual equity" value={formatCurrency(portfolio.totalEquity)} icon={<Activity className="size-4" aria-hidden="true" />} />
          <Metric label="Total return" value={formatPercent(portfolio.returnPercent)} positive={Number(portfolio.returnPercent) >= 0} icon={<TrendingUp className="size-4" aria-hidden="true" />} />
          <Metric label="Current rank" value={leaderboardHidden ? 'HIDDEN' : rank ? `#${rank}` : '—'} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <MarketList markets={markets} positions={portfolio.positions} selectedMarketId={selectedMarket?.marketId ?? ''} onSelect={(id) => { setSelectedMarketId(id); setOrderSide('BUY') }} />
        {selectedMarket ? (
          <main className="min-w-0 space-y-4">
            <MarketWorkspace missionId={mission.id} market={selectedMarket} quantity={selectedPosition?.quantity ?? '0'} averageEntryPrice={selectedPosition?.averageEntryPrice ?? '0'} unrealizedPnl={selectedPosition?.unrealizedPnl ?? '0'} />
            <OrderTicket key={`${selectedMarket.marketId}:${orderSide}`} mission={mission} marketId={selectedMarket.marketId} symbol={selectedMarket.symbol} price={selectedMarket.currentPrice} enabled={selectedMarket.enabled} side={orderSide} onSideChange={setOrderSide} portfolio={portfolio} onPortfolioUpdate={onPortfolioUpdate} onOrderFilled={onOrderFilled} />
          </main>
        ) : <div className="border border-danger/40 bg-danger/5 p-6 text-sm text-danger" role="alert">No current price is available for this mission.</div>}
        <CommandBoard rows={leaderboard} currentUserId={portfolio.userId} hidden={leaderboardHidden} error={leaderboardError} />
      </div>

      <PositionsTable positions={portfolio.positions} onSell={quickSell} />
      <TradeHistory orders={orders} error={ordersError} />
    </div>
  )
}

function Metric({ label, value, icon, positive }: { label: string; value: string; icon?: ReactNode; positive?: boolean }) {
  return <dl className="min-w-28 border-l border-line pl-4"><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">{icon}{label}</dt><dd className={`mt-1 font-mono text-sm ${positive === undefined ? 'text-ink' : positive ? 'text-primary' : 'text-danger'}`}>{value}</dd></dl>
}

function MarketList({ markets, positions, selectedMarketId, onSelect }: { markets: MarketPrice[]; positions: Portfolio['positions']; selectedMarketId: string; onSelect: (id: string) => void }) {
  return <aside className="border border-line bg-surface" aria-labelledby="markets-title"><div className="border-b border-line px-4 py-3"><h2 id="markets-title" className="text-sm font-semibold uppercase tracking-wider text-ink">Market watch</h2></div><div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 xl:grid-cols-1">{markets.map((market) => { const selected = market.marketId === selectedMarketId; const held = positions.some((position) => position.marketId === market.marketId); return <button key={market.marketId} type="button" onClick={() => onSelect(market.marketId)} aria-pressed={selected} className={`focus-ring min-h-16 bg-surface px-4 py-3 text-left hover:bg-canvas ${selected ? 'border-l-2 border-primary' : 'border-l-2 border-transparent'}`}><span className="flex items-center gap-2 font-semibold text-ink">{held && <span className="size-1.5 rounded-full bg-primary" aria-label="Open position" />}{market.symbol}</span><span className="mt-1 flex items-center justify-between gap-2 font-mono text-xs"><span className="text-muted">{formatPrice(market.currentPrice)}</span><span className={Number(market.changePercent) >= 0 ? 'text-primary' : 'text-danger'}>{formatPercent(market.changePercent)}</span></span></button> })}</div></aside>
}
function MarketWorkspace({ missionId, market, quantity, averageEntryPrice, unrealizedPnl }: { missionId: string; market: MarketPrice; quantity: string; averageEntryPrice: string; unrealizedPnl: string }) {
  return (
    <section className="border border-line bg-surface">
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
      <Suspense fallback={<div className="h-80 animate-pulse border-t border-line bg-canvas/40 sm:h-96" aria-busy="true" aria-label="Loading candlestick chart" />}><CandlestickChart key={market.marketId} missionId={missionId} marketId={market.marketId} symbol={market.symbol} /></Suspense>
    </section>
  )
}

function OrderTicket({ mission, marketId, symbol, price, enabled, side, onSideChange, portfolio, onPortfolioUpdate, onOrderFilled }: { mission: Mission; marketId: string; symbol: string; price: string; enabled: boolean; side: OrderSide; onSideChange: (side: OrderSide) => void; portfolio: Portfolio; onPortfolioUpdate: (portfolio: Portfolio) => void; onOrderFilled: () => Promise<void> }) {
  const [amount, setAmount] = useState(''); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null)
  const position = portfolio.positions.find((item) => item.marketId === marketId)
  const maximum = useMemo(() => { if (side === 'SELL') return Number(position?.quantity ?? 0); const cap = Number(portfolio.startingBalance) * 0.3; const exposure = Number(position?.quantity ?? 0) * Number(price); return Math.max(0, Math.min(Number(portfolio.cashBalance), cap - exposure)) }, [portfolio.cashBalance, portfolio.startingBalance, position?.quantity, price, side])
  const tradingOpen = (mission.status === 'ACTIVE' || mission.status === 'BLACKOUT') && enabled
  const maximumExposure = Number(portfolio.startingBalance) * 0.3
  function selectSide(value: OrderSide) { onSideChange(value); setAmount(''); setError(null); setSuccess(null) }
  function applyQuickValue(ratio: number) { setAmount((maximum * ratio).toFixed(side === 'BUY' ? 2 : 8).replace(/\.?0+$/, '')) }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); setSuccess(null); const numericAmount = Number(amount); if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError(`Enter a valid ${side === 'BUY' ? 'virtual USDC amount' : `${symbol} quantity`}.`); return } setSubmitting(true); try { const { data } = await placeOrder(mission.id, side === 'BUY' ? { marketId, side, notional: numericAmount } : { marketId, side, quantity: numericAmount }); onPortfolioUpdate(data.portfolio); setSuccess(`${side} filled via ${data.fill.quoteProvider}${data.fill.quoteRouter ? `/${data.fill.quoteRouter}` : ''}: ${formatToken(data.fill.quantity)} ${symbol} at ${formatPrice(data.fill.executionPrice)}${data.fill.priceImpactPercent ? ` · ${Number(data.fill.priceImpactPercent).toFixed(3)}% impact` : ''}.`); setAmount(''); await onOrderFilled() } catch (orderError: unknown) { setError(orderError instanceof Error ? orderError.message : 'Order could not be executed.') } finally { setSubmitting(false) } }
  return <section id="order-ticket" className="border border-line bg-surface p-5"><div className="grid grid-cols-2 gap-2" aria-label="Order side">{(['BUY', 'SELL'] as const).map((value) => <button key={value} type="button" onClick={() => selectSide(value)} aria-pressed={side === value} className={`focus-ring min-h-11 border text-sm font-semibold ${side === value ? value === 'BUY' ? 'border-primary bg-primary/10 text-primary' : 'border-danger bg-danger/10 text-danger' : 'border-line text-muted hover:text-ink'}`}>{value}</button>)}</div><form className="mt-5" onSubmit={submit}><label htmlFor="order-amount" className="text-sm font-medium text-ink">{side === 'BUY' ? 'Amount (virtual USDC)' : `Quantity (${symbol})`}</label><div className="mt-2 flex border border-line bg-canvas focus-within:border-primary"><input id="order-amount" type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'order-error' : 'order-help'} placeholder={side === 'BUY' ? '100.00' : '0.00'} className="min-h-12 min-w-0 flex-1 bg-transparent px-3 font-mono text-ink focus:outline-none" /><span className="grid place-items-center px-3 font-mono text-xs text-muted">{side === 'BUY' ? 'vUSDC' : symbol}</span></div><p id="order-help" className="mt-2 text-xs text-muted">{side === 'BUY' ? `Maximum market exposure: ${formatCurrency(maximumExposure)} · currently available: ${formatCurrency(maximum)} · minimum $100` : `Available to sell: ${formatToken(maximum)} ${symbol}`}</p><div className="mt-4 grid grid-cols-4 gap-2">{[0.1, 0.25, 0.5, 1].map((ratio) => <button key={ratio} type="button" onClick={() => applyQuickValue(ratio)} className="focus-ring min-h-10 border border-line font-mono text-xs text-muted hover:border-primary hover:text-ink">{ratio === 1 ? 'MAX' : `${ratio * 100}%`}</button>)}</div>{error && <p id="order-error" className="mt-4 text-sm text-danger" role="alert">{error}</p>}{success && <p className="mt-4 text-sm text-primary" role="status">{success}</p>}<button type="submit" disabled={submitting || !tradingOpen} aria-busy={submitting} className={`focus-ring mt-5 min-h-12 w-full text-sm font-semibold ${side === 'BUY' ? 'bg-primary text-primary-ink hover:bg-primary-strong' : 'bg-danger text-canvas'} disabled:cursor-not-allowed disabled:bg-line disabled:text-muted`}>{submitting ? 'Executing…' : !enabled ? 'Market disabled' : !tradingOpen ? 'Trading locked' : side}</button></form></section>
}
