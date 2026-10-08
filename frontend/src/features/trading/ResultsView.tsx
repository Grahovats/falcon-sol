import { ArrowLeft, Medal, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency, formatPercent } from '../../lib/format'
import type { Mission } from '../../types/mission'
import type { LeaderboardRow, Portfolio } from '../../types/trading'
import { CommandBoard } from './CommandBoard'

export function ResultsView({ mission, portfolio, rows, loading, error }: { mission: Mission; portfolio?: Portfolio; rows: LeaderboardRow[]; loading: boolean; error?: string }) {
  const personal = portfolio ? rows.find((row) => row.userId === portfolio.userId) : undefined
  const bestPosition = portfolio?.positions.reduce((best, position) => !best || Number(position.unrealizedPnl) > Number(best.unrealizedPnl) ? position : best, undefined as Portfolio['positions'][number] | undefined)
  return <div className="space-y-4"><section className="app-surface panel-cut border border-line bg-surface p-6 sm:p-10"><h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-5xl">{mission.name}</h1><p className="mt-3 text-muted">Trading has ended. Final standings and participant results are now available.</p>{portfolio ? <dl className="app-metrics mt-8 grid gap-px bg-line sm:grid-cols-3"><ResultMetric label="Final equity" value={formatCurrency(portfolio.totalEquity)} /><ResultMetric label="Return" value={formatPercent(portfolio.returnPercent)} /><ResultMetric label="Final rank" value={personal ? `#${personal.rank}` : 'Unranked'} /></dl> : <p className="mt-8 border border-line bg-canvas p-4 text-sm text-muted">You did not deploy into this mission. The final command board is still visible below.</p>}{bestPosition && <div className="mt-6 flex items-center gap-3 border border-line bg-canvas p-4"><Medal className="size-5 text-primary" aria-hidden="true" /><p className="text-sm text-muted">Best open position: <strong className="text-ink">{bestPosition.symbol}</strong> at <span className={Number(bestPosition.unrealizedPnl) >= 0 ? 'text-primary' : 'text-danger'}>{formatCurrency(bestPosition.unrealizedPnl)}</span></p></div>}<Link to="/missions" className="app-button focus-ring mt-8 inline-flex min-h-11 items-center gap-2 border border-line px-4 text-sm text-ink hover:border-primary"><ArrowLeft className="size-4" aria-hidden="true" /> Return to missions</Link></section><div className="grid gap-4 lg:grid-cols-[1fr_20rem]"><section className="app-surface border border-line bg-surface p-6"><Trophy className="size-7 text-primary" aria-hidden="true" /><h2 className="mt-4 text-xl font-semibold text-ink">Operation complete</h2><p className="mt-2 text-sm leading-6 text-muted">Performance is marked against the mission’s virtual starting balance. No real assets were used.</p></section>{loading ? <div className="app-surface h-64 animate-pulse border border-line bg-surface" /> : <CommandBoard rows={rows} currentUserId={portfolio?.userId ?? ''} error={error} />}</div></div>
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return <div className="bg-canvas p-5"><dt className="text-xs uppercase tracking-wider text-muted">{label}</dt><dd className="mt-2 font-mono text-xl text-ink">{value}</dd></div>
}
