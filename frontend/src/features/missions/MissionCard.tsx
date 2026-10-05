import { ArrowRight, ChartNoAxesColumnIncreasing, Clock3, Coins, Users } from 'lucide-react'
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
  const timeLabel = live ? 'Time remaining' : upcoming ? 'Starts in' : 'Mission status'
  const timeValue = live || upcoming ? countdown : mission.status.toLowerCase()
  const visibleMarkets = mission.markets.slice(0, 3)

  return (
    <article
      style={entranceStyle}
      className="mission-card-modern stagger-item interactive-lift group relative flex h-full min-h-72 flex-col overflow-hidden rounded-xl border border-line bg-surface p-4 hover:border-primary/55"
    >
      <img className="mission-card-backdrop" src="/mision baground.png" alt="" />
      <div className="mission-card-shadow" aria-hidden="true" />

      <div className="absolute right-4 top-4 z-10 flex w-24 flex-col gap-1.5">
        <span className="flex min-h-7 w-full items-center justify-center rounded-md border border-line bg-canvas/75 px-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted backdrop-blur-sm">
          {formatDuration(mission.startsAt, mission.endsAt)}
        </span>
        <span className="flex min-h-7 w-full items-center justify-center rounded-md border border-primary/25 bg-canvas/75 px-1.5 backdrop-blur-sm [&>span]:gap-1.5 [&>span]:text-[10px]">
          <StatusBadge status={mission.status} />
        </span>
      </div>

      <div className="relative min-h-16 pr-28">
        <h3 className="line-clamp-2 text-xl font-semibold tracking-[-0.035em] text-ink">{mission.name}</h3>
        <div className="mt-2 flex items-center gap-2">
          <Clock3 className="size-3.5 text-primary" aria-hidden="true" />
          <span className="text-xs text-muted">{timeLabel}</span>
          <span className="font-mono text-xs font-semibold tabular-nums text-ink">{timeValue}</span>
        </div>
      </div>
      <p className="relative mt-2 line-clamp-2 max-w-md text-xs leading-5 text-muted">{mission.description ?? 'Trade the roster. Protect your downside.'}</p>

      <div className="relative mt-3 flex flex-wrap items-center gap-1.5" aria-label="Mission markets">
          {visibleMarkets.map((market) => (
            <span key={market.id} className="rounded-full border border-line bg-canvas/75 px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wide text-ink backdrop-blur-sm">
              {market.symbol}
            </span>
          ))}
          {mission.marketCount > visibleMarkets.length && (
            <span className="rounded-full border border-line bg-canvas/75 px-2.5 py-1 font-mono text-[9px] text-muted backdrop-blur-sm">
              +{mission.marketCount - visibleMarkets.length}
            </span>
          )}
          {visibleMarkets.length === 0 && <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Roster pending</span>}
      </div>

      <div className="relative mt-auto pt-4">
        <dl className="grid grid-cols-3 divide-x divide-line border-t border-line bg-canvas/55 py-3 backdrop-blur-sm">
          <MissionMetric icon={<Coins />} label="Virtual capital" value={formatVirtualBalance(mission.startingBalance)} />
          <MissionMetric icon={<Users />} label="Operators" value={String(mission.operatorCount)} />
          <MissionMetric icon={<ChartNoAxesColumnIncreasing />} label="Markets" value={String(mission.marketCount)} />
        </dl>
        <Link
          to={`/missions/${mission.id}`}
          className="directional-action focus-ring mt-3 flex min-h-10 w-full items-center justify-center gap-3 rounded-md bg-primary px-4 text-xs font-semibold text-primary-ink hover:bg-primary-strong"
        >
          {live ? 'Join mission' : upcoming ? 'View mission' : 'View results'}
          <ArrowRight className="action-icon size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

function MissionMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 px-2.5 first:pl-0 last:pr-0">
      <dt className="flex items-center gap-1 truncate text-[8px] uppercase tracking-wider text-muted [&>svg]:size-3 [&>svg]:shrink-0 [&>svg]:text-primary">{icon}{label}</dt>
      <dd className="mt-1.5 truncate font-mono text-xs font-semibold tabular-nums text-ink">{value}</dd>
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
