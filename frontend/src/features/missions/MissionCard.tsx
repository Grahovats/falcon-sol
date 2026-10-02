import { ArrowRight, Coins, Crosshair, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCountdown } from '../../hooks/useCountdown'
import { formatVirtualBalance } from '../../lib/format'
import type { Mission } from '../../types/mission'
import { StatusBadge } from './StatusBadge'

export function MissionCard({ mission }: { mission: Mission }) {
  const live = mission.status === 'ACTIVE' || mission.status === 'BLACKOUT'
  const upcoming = ['DRAFT', 'REGISTRATION', 'LOCKED'].includes(mission.status)
  const countdown = useCountdown(live ? mission.endsAt : mission.startsAt)

  if (upcoming) {
    return <article className="interactive-lift flex min-h-20 items-center justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3 hover:border-primary/35"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-ink">{mission.name}</h3><p className="mt-1 font-mono text-[10px] text-muted">Starts in {countdown}</p></div><div className="shrink-0 text-right"><p className="font-mono text-xs font-semibold text-ink">{formatVirtualBalance(mission.startingBalance)}</p><p className="mt-1 text-[10px] text-primary">{mission.marketCount} markets</p></div><Link to={`/missions/${mission.id}`} className="focus-ring grid size-10 shrink-0 place-items-center rounded-md border border-line text-primary hover:border-primary" aria-label={`View ${mission.name}`}><ArrowRight className="size-4" aria-hidden="true" /></Link></article>
  }

  return (
    <article className={`interactive-lift flex h-full flex-col overflow-hidden rounded-xl border ${live ? 'accent-panel lime-shine border-primary/35' : 'border-line bg-surface hover:border-line-strong'}`}>
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <StatusBadge status={mission.status} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{mission.marketCount.toString().padStart(2, '0')} markets</span>
      </div>
      <div className="px-5 pb-5">
        <h3 className="mt-5 text-base font-semibold text-ink">{mission.name}</h3>
        <p className="mt-5 font-mono text-3xl font-semibold tracking-[-0.05em] text-ink">{formatVirtualBalance(mission.startingBalance)}</p>
        <p className="mt-1 text-xs text-muted">Virtual capital</p>
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-5 border-y border-line px-5 py-5 text-sm">
        <CardMetric icon={<Coins />} label="Entry" value="Free" />
        <CardMetric icon={<Users />} label="Operators" value={String(mission.operatorCount)} />
        <CardMetric icon={<Crosshair />} label="Market roster" value={`${mission.marketCount} enabled`} />
        <div><dt className="text-xs text-muted">{live ? 'Ends in' : upcoming ? 'Starts in' : 'Status'}</dt><dd className="mt-1.5 font-mono text-sm tabular-nums text-ink">{live || upcoming ? countdown : mission.status.toLowerCase()}</dd></div>
      </dl>
      {live && <div className="border-b border-line bg-primary/5 px-5 py-3"><div className="flex items-center justify-between text-[10px]"><span className="font-medium text-primary">Mission live</span><span className="font-mono text-muted">{mission.marketCount} assets</span></div><div className="mt-2 h-1 rounded-full bg-line"><div className="h-full w-full rounded-full bg-primary" /></div></div>}
      <div className="p-4">
        <Link to={`/missions/${mission.id}`} className={`focus-ring flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold motion-safe:transition-colors motion-safe:duration-100 ${live ? 'bg-primary text-primary-ink hover:bg-primary-strong' : 'border border-line bg-surface-raised text-ink hover:border-primary/60'}`}>{live ? 'Open terminal' : 'View mission'} <ArrowRight className="size-4" aria-hidden="true" /></Link>
      </div>
    </article>
  )
}

function CardMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div><dt className="flex items-center gap-1.5 text-xs text-muted [&>svg]:size-3.5">{icon}{label}</dt><dd className="mt-1.5 font-mono text-sm text-ink">{value}</dd></div>
}
