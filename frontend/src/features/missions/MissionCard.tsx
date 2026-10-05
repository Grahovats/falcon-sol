import { ArrowRight, ChartNoAxesColumnIncreasing, ShieldCheck, Users } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useCountdown } from '../../hooks/useCountdown'
import { formatVirtualBalance } from '../../lib/format'
import type { Mission } from '../../types/mission'
import { StatusBadge } from './StatusBadge'

const MISSION_CARD_TIMING = {
  staggerMs: 60,
} as const

const UPCOMING_STATUSES = new Set(['DRAFT', 'REGISTRATION', 'LOCKED'])
const LIVE_STATUSES = new Set(['ACTIVE', 'BLACKOUT'])

export function MissionCard({ mission, entranceIndex = 0 }: { mission: Mission; entranceIndex?: number }) {
  const live = LIVE_STATUSES.has(mission.status)
  const upcoming = UPCOMING_STATUSES.has(mission.status)
  const countdown = useCountdown(live ? mission.endsAt : mission.startsAt)
  const entranceStyle = {
    '--stagger-delay': `${entranceIndex * MISSION_CARD_TIMING.staggerMs}ms`,
  } as CSSProperties
  const progress = getMissionProgress(mission)
  const timeLabel = live ? 'Time remaining' : upcoming ? 'Starts in' : 'Mission status'
  const timeValue = live || upcoming ? countdown : mission.status.toLowerCase()

  return (
    <article
      style={entranceStyle}
      className="stagger-item interactive-lift flex h-full min-h-[25rem] flex-col rounded-xl border border-line bg-surface p-5 hover:border-primary/35 sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <StatusBadge status={mission.status} />
        <span className="font-mono text-xs uppercase tracking-wider text-muted">{formatDuration(mission.startsAt, mission.endsAt)}</span>
      </div>

      <div className="mt-6 min-h-16">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-ink">{mission.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted">{mission.description ?? 'Trade the roster. Protect your downside.'}</p>
      </div>

      <div className="mt-5">
        <p className="font-mono text-3xl font-semibold tabular-nums tracking-[-0.06em] text-ink sm:text-4xl">{formatVirtualBalance(mission.startingBalance)}</p>
        <p className="mt-2 text-xs text-muted">Virtual starting capital</p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 text-xs">
        <span className="flex items-center gap-2 font-medium text-ink"><ShieldCheck className="size-4 text-primary" aria-hidden="true" />Free entry</span>
        <span className="text-muted">No risk. All skill.</span>
      </div>

      <dl className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4 text-xs">
        <CardMetric icon={<Users />} value={`${mission.operatorCount} ${mission.operatorCount === 1 ? 'participant' : 'participants'}`} />
        <CardMetric icon={<ChartNoAxesColumnIncreasing />} value={`${mission.marketCount} markets`} />
      </dl>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-muted">{timeLabel}</span>
          <span className="font-mono font-semibold tabular-nums text-ink">{timeValue}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-auto pt-5">
        <Link
          to={`/missions/${mission.id}`}
          className="directional-action focus-ring flex min-h-11 w-full items-center justify-between rounded-md border border-line-strong bg-surface-raised px-4 text-sm font-semibold text-ink hover:border-primary/60 hover:text-primary"
        >
          {live ? 'Open terminal' : upcoming ? 'View mission' : 'View results'}
          <ArrowRight className="action-icon size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

function CardMetric({ icon, value }: { icon: React.ReactNode; value: string }) {
  return <div><dt className="sr-only">Mission metric</dt><dd className="flex items-center gap-2 text-muted [&>svg]:size-4 [&>svg]:shrink-0">{icon}{value}</dd></div>
}

function formatDuration(startsAt: string, endsAt: string) {
  const durationHours = Math.max(1, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000))
  if (durationHours < 24) return `${durationHours} ${durationHours === 1 ? 'hour' : 'hours'}`
  if (durationHours % 24 === 0) {
    const days = durationHours / 24
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }
  return `${durationHours} hours`
}

function getMissionProgress(mission: Mission) {
  if (UPCOMING_STATUSES.has(mission.status)) return 0
  if (!LIVE_STATUSES.has(mission.status)) return 100

  const startsAt = new Date(mission.startsAt).getTime()
  const endsAt = new Date(mission.endsAt).getTime()
  const duration = endsAt - startsAt
  if (duration <= 0) return 100
  return Math.min(100, Math.max(0, ((Date.now() - startsAt) / duration) * 100))
}
