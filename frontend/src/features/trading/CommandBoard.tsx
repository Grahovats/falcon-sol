import { formatCurrency, formatPercent } from '../../lib/format'
import type { LeaderboardRow } from '../../types/trading'

interface CommandBoardProps {
  rows: LeaderboardRow[]
  currentUserId: string
  hidden?: boolean
  error?: string
}

export function CommandBoard({ rows, currentUserId, hidden = false, error }: CommandBoardProps) {
  return (
    <section className="border border-line bg-surface" aria-labelledby="command-board-title">
      <div className="border-b border-line px-4 py-3"><h2 id="command-board-title" className="text-sm font-semibold uppercase tracking-wider text-ink">Command Board</h2></div>
      {error ? <p className="p-4 text-sm text-danger">{error}</p> : hidden ? <div className="p-6"><h3 className="text-sm font-semibold text-ink">Blackout protocol</h3><p className="mt-3 text-sm leading-6 text-muted">Rankings are concealed for the final three minutes. Trading remains open until the mission clock expires.</p></div> : rows.length === 0 ? <p className="p-6 text-sm text-muted">No operators ranked yet.</p> : (
        <ol className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.userId} className={`grid grid-cols-[2rem_1fr_auto] items-center gap-2 px-4 py-3 text-sm ${row.userId === currentUserId ? 'bg-primary/5' : ''}`}>
              <span className="font-mono text-muted">{row.rank.toString().padStart(2, '0')}</span>
              <span className="min-w-0"><span className="block truncate font-medium text-ink">{row.displayName}</span><span className="font-mono text-xs text-muted">{formatCurrency(row.equity)} · {formatCurrency(row.pnl)} PnL</span></span>
              <span className={`font-mono text-xs ${Number(row.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(row.returnPercent)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
