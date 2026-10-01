import { ArrowUpRight, CalendarDays, Coins, Crosshair, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCountdown } from '../../hooks/useCountdown'
import { formatDate, formatVirtualBalance } from '../../lib/format'
import type { Mission } from '../../types/mission'
import { StatusBadge } from './StatusBadge'

export function MissionCard({ mission }: { mission: Mission }) {
  const live = mission.status === 'ACTIVE' || mission.status === 'BLACKOUT'
  const countdown = useCountdown(live ? mission.endsAt : mission.startsAt)
  return (
    <article className="panel-cut interactive-lift flex h-full flex-col border border-line bg-surface p-5 hover:border-primary/50 sm:p-6">
      <div className="flex items-start justify-between gap-4"><StatusBadge status={mission.status} /><span className="font-mono text-xs text-muted">{mission.marketCount.toString().padStart(2, '0')} MKTS</span></div>
      <h2 className="mt-8 text-xl font-semibold text-ink">{mission.name}</h2>
      <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-muted">{mission.description ?? 'Mission parameters are ready for operator review.'}</p>
      <dl className="mt-6 grid gap-4 border-y border-line py-5 text-sm sm:grid-cols-2">
        <div><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><Coins className="size-4" aria-hidden="true" /> Virtual capital</dt><dd className="mt-2 font-mono text-ink">{formatVirtualBalance(mission.startingBalance)}</dd></div>
        <div><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><Crosshair className="size-4" aria-hidden="true" /> Markets</dt><dd className="mt-2 font-mono text-ink">{mission.marketCount} enabled</dd></div>
        <div><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><Users className="size-4" aria-hidden="true" /> Operators</dt><dd className="mt-2 font-mono text-ink">{mission.operatorCount}</dd></div>
        {(live || mission.status === 'REGISTRATION' || mission.status === 'LOCKED' || mission.status === 'DRAFT') && <div><dt className="text-xs uppercase tracking-wider text-muted">{live ? 'Ends in' : 'Starts in'}</dt><dd className="mt-2 font-mono text-ink">{countdown}</dd></div>}
        <div className="sm:col-span-2"><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><CalendarDays className="size-4" aria-hidden="true" /> Operation window</dt><dd className="mt-2 text-ink">{formatDate(mission.startsAt)} — {formatDate(mission.endsAt)}</dd></div>
      </dl>
      <Link to={`/missions/${mission.id}`} className="focus-ring mt-5 flex min-h-11 items-center justify-between rounded-sm font-medium text-primary">View mission brief <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
    </article>
  )
}
