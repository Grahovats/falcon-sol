import { ArrowUpRight, Cpu, Users } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useCountdown } from '../../hooks/useCountdown'
import { formatDate, formatVirtualBalance } from '../../lib/format'
import { resetGlassSheen, updateGlassSheen } from '../../lib/glass-hover'
import type { Mission } from '../../types/mission'
import { StatusBadge } from './StatusBadge'

// Cards settle into the grid at 60 ms intervals, within a 300 ms budget.
const MISSION_CARD_TIMING = { staggerMs: 60, maxDelayMs: 300 } as const
const UPCOMING_STATUSES = new Set(['DRAFT', 'REGISTRATION', 'LOCKED'])
const LIVE_STATUSES = new Set(['ACTIVE', 'BLACKOUT'])
const RESULT_STATUSES = new Set(['FINALIZED', 'CLOSED'])

export function MissionCard({ mission, entranceIndex = 0 }: { mission: Mission; entranceIndex?: number }) {
  const live = LIVE_STATUSES.has(mission.status)
  const upcoming = UPCOMING_STATUSES.has(mission.status)
  const countdown = useCountdown(live ? mission.endsAt : mission.startsAt)
  const entranceStyle = {
    '--stagger-delay': `${Math.min(entranceIndex * MISSION_CARD_TIMING.staggerMs, MISSION_CARD_TIMING.maxDelayMs)}ms`,
  } as CSSProperties
  const timeLabel = live ? 'Time remaining' : upcoming ? 'Starts in' : mission.status === 'CANCELLED' ? 'Cancelled' : 'Trading ended'
  const timeValue = live || upcoming ? countdown : mission.status === 'CANCELLED' ? '—' : formatDate(mission.endsAt)
  const canJoin = live || mission.status === 'REGISTRATION'
  const actionLabel = canJoin ? 'Join mission' : RESULT_STATUSES.has(mission.status) ? 'View results' : 'View mission'

  return (
    <div style={entranceStyle} className="stagger-item h-full min-w-0">
    <article onPointerEnter={updateGlassSheen} onPointerMove={updateGlassSheen} onPointerLeave={resetGlassSheen} className="grain-surface mission-card-modern mission-credit-card group flex h-full min-w-0 flex-col p-4">
      <span className="journey-sheen" aria-hidden="true" />
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-widest text-muted">FALCON <span className="ml-2 font-normal tracking-normal">{formatDuration(mission.startsAt, mission.endsAt)}</span></span>
        <StatusBadge status={mission.status} />
      </header>

      <h3 title={mission.name} className="mt-2 truncate text-lg font-semibold leading-tight tracking-tight text-ink">{mission.name}</h3>

      <dl className="my-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Cpu className="size-6 shrink-0 text-primary" strokeWidth={1} aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-muted">Virtual capital</dt>
            <dd className="mt-1 break-words text-2xl font-medium leading-none tracking-tight tabular-nums text-ink">{formatVirtualBalance(mission.startingBalance)}</dd>
          </div>
        </div>
        <div className="text-right">
          <dt className="flex items-center justify-end gap-1.5 text-xs text-muted"><Users className="size-3.5" aria-hidden="true" />Operators</dt>
          <dd className="mt-1 text-lg font-medium leading-none tabular-nums text-ink">{mission.operatorCount}</dd>
        </div>
      </dl>

      <footer className="mt-auto flex items-center justify-between gap-3">
        <dl className="min-w-0 text-xs">
          <dt className="text-muted">{timeLabel}</dt>
          <dd className={`mt-1 font-medium tabular-nums ${live ? 'text-primary' : 'text-ink'}`}>{timeValue}</dd>
        </dl>
        <Link
          to={`/missions/${mission.id}`}
          aria-label={`${actionLabel}: ${mission.name}`}
          className={`app-button directional-action focus-ring flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold ${canJoin ? 'bg-primary text-primary-ink hover:bg-primary-strong' : 'app-button-plain text-ink hover:text-primary'}`}
        >
          {actionLabel}
          <ArrowUpRight className="action-icon size-4" aria-hidden="true" />
        </Link>
      </footer>
    </article>
    </div>
  )
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
