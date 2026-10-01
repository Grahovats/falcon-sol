import { formatCurrency, formatPercent, formatPrice, formatToken } from '../../lib/format'
import type { Position } from '../../types/trading'

export function PositionsTable({ positions, onSell }: { positions: Position[]; onSell: (marketId: string) => void }) {
  return (
    <section className="border border-line bg-surface" aria-labelledby="positions-title">
      <div className="border-b border-line px-4 py-3"><h2 id="positions-title" className="text-sm font-semibold uppercase tracking-wider text-ink">Open Positions</h2></div>
      {positions.length === 0 ? (
        <div className="p-8 text-center"><p className="font-medium text-ink">No open positions</p><p className="mt-2 text-sm text-muted">Select a market and place a buy order to establish one.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-line font-mono text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-3 font-normal">Market</th><th className="px-4 py-3 font-normal">Quantity</th><th className="px-4 py-3 font-normal">Avg entry</th><th className="px-4 py-3 font-normal">Current</th><th className="px-4 py-3 font-normal">Value</th><th className="px-4 py-3 font-normal">Allocation</th><th className="px-4 py-3 font-normal">Unrealized PnL</th><th className="px-4 py-3 font-normal">Return</th><th className="px-4 py-3 font-normal">Action</th></tr></thead>
            <tbody className="divide-y divide-line">
              {positions.map((position) => <tr key={position.marketId}><td className="px-4 py-4 font-semibold text-ink">{position.symbol}</td><td className="px-4 py-4 font-mono text-ink">{formatToken(position.quantity)}</td><td className="px-4 py-4 font-mono text-muted">{formatPrice(position.averageEntryPrice)}</td><td className="px-4 py-4 font-mono text-muted">{formatPrice(position.currentPrice)}</td><td className="px-4 py-4 font-mono text-ink">{formatCurrency(position.marketValue)}</td><td className="px-4 py-4 font-mono text-muted">{formatPercent(position.allocationPercent)}</td><td className={`px-4 py-4 font-mono ${Number(position.unrealizedPnl) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatCurrency(position.unrealizedPnl)}</td><td className={`px-4 py-4 font-mono ${Number(position.unrealizedPnlPercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(position.unrealizedPnlPercent)}</td><td className="px-4 py-4"><button type="button" onClick={() => onSell(position.marketId)} className="focus-ring min-h-10 border border-danger/50 px-3 text-xs font-semibold text-danger hover:bg-danger/10">SELL</button></td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
