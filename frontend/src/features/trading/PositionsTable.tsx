import { useState } from 'react'
import { formatCurrency, formatPercent, formatPrice, formatToken } from '../../lib/format'
import type { Portfolio, Position } from '../../types/trading'
import { PositionExitsModal } from './PositionExitsModal'

type PositionsTableProps = {
  className?: string
  missionId: string
  positions: Position[]
  enabledMarketIds: Set<string>
  onSell: (marketId: string) => void
  onPortfolioUpdate: (portfolio: Portfolio) => void
}

export function PositionsTable({ positions, missionId, enabledMarketIds, onSell, onPortfolioUpdate, className = '' }: PositionsTableProps) {
  const [editingMarketId, setEditingMarketId] = useState<string | null>(null)
  const editingPosition = positions.find((position) => position.marketId === editingMarketId)
  return (
    <section className={`app-surface border-t border-line bg-surface ${className}`} aria-labelledby="positions-title">
      <div className="terminal-panel-heading"><h2 id="positions-title" className="text-sm font-semibold text-ink">Open positions</h2></div>
      {positions.length === 0 ? (
        <div className="p-8 text-center"><p className="font-medium text-ink">No open positions</p><p className="mt-2 text-sm text-muted">Select a market and place a buy order to establish one.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="app-table w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-line font-mono text-xs uppercase tracking-wider text-muted"><tr>{['Market', 'TP/SL', 'Quantity', 'Avg entry', 'Current', 'Value', 'Allocation', 'Unrealized PnL', 'Return', 'Action'].map((label) => <th key={label} className={`px-4 py-3 font-normal ${label === 'Action' ? 'text-right' : ''}`}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {positions.map((position) => <tr key={position.marketId}>
                <td className="px-4 py-4 font-semibold text-ink">{position.symbol}</td>
                <td className="px-4 py-4">
                  <button type="button" disabled={!enabledMarketIds.has(position.marketId)} onClick={() => setEditingMarketId(position.marketId)} aria-haspopup="dialog" aria-label={`TP/SL for ${position.symbol}`} className="app-button app-table-action focus-ring min-h-10 whitespace-nowrap rounded-sm border border-line px-3 text-xs font-semibold text-ink hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50">{position.takeProfitPrice !== null || position.stopLossPrice !== null ? <span className="inline-flex items-center gap-1 tabular-nums"><span className={position.takeProfitPrice === null ? 'text-muted' : 'text-primary'}>{position.takeProfitPrice === null ? '—' : formatPrice(position.takeProfitPrice).replace('$', '')}</span><span className="text-muted">/</span><span className={position.stopLossPrice === null ? 'text-muted' : 'text-danger'}>{position.stopLossPrice === null ? '—' : formatPrice(position.stopLossPrice).replace('$', '')}</span></span> : 'TP/SL'}</button>
                </td>
                <td className="px-4 py-4 font-mono text-ink">{formatToken(position.quantity)}</td>
                <td className="px-4 py-4 font-mono text-muted">{formatPrice(position.averageEntryPrice)}</td>
                <td className="px-4 py-4 font-mono text-muted">{formatPrice(position.currentPrice)}</td>
                <td className="px-4 py-4 font-mono text-ink">{formatCurrency(position.marketValue)}</td>
                <td className="px-4 py-4 font-mono text-muted">{formatPercent(position.allocationPercent)}</td>
                <td className={`px-4 py-4 font-mono ${Number(position.unrealizedPnl) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatCurrency(position.unrealizedPnl)}</td>
                <td className={`px-4 py-4 font-mono ${Number(position.unrealizedPnlPercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(position.unrealizedPnlPercent)}</td>
                <td className="px-4 py-4 text-right"><button type="button" disabled={!enabledMarketIds.has(position.marketId)} onClick={() => onSell(position.marketId)} className="app-button app-table-action focus-ring min-h-10 rounded-sm border border-danger/50 px-3 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50">SELL</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
      {editingPosition && <PositionExitsModal key={editingPosition.marketId} missionId={missionId} position={editingPosition} enabled={enabledMarketIds.has(editingPosition.marketId)} onPortfolioUpdate={onPortfolioUpdate} onDismiss={() => setEditingMarketId(null)} />}
    </section>
  )
}
