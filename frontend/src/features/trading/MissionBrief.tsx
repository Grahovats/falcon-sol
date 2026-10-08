import { CalendarDays, Coins, Crosshair, Radio, Users } from 'lucide-react'
import { formatDate, formatVirtualBalance } from '../../lib/format'
import type { Mission } from '../../types/mission'
import { StatusBadge } from '../missions/StatusBadge'

interface MissionBriefProps {
  mission: Mission
  deploying: boolean
  error: string | null
  onDeploy: () => void
}

export function MissionBrief({ mission, deploying, error, onDeploy }: MissionBriefProps) {
  const deployable = mission.status === 'REGISTRATION' || mission.status === 'ACTIVE'

  return (
    <section className="app-surface panel-cut border border-line bg-surface p-6 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <StatusBadge status={mission.status} />
      </div>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">{mission.name}</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">{mission.description ?? 'Full mission briefing pending.'}</p>

      <dl className="mt-10 grid gap-6 border-y border-line py-8 sm:grid-cols-4">
        <div><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><Coins className="size-4" aria-hidden="true" /> Virtual capital</dt><dd className="mt-2 font-mono text-lg text-ink">{formatVirtualBalance(mission.startingBalance)}</dd></div>
        <div><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><Crosshair className="size-4" aria-hidden="true" /> Approved markets</dt><dd className="mt-2 font-mono text-lg text-ink">{mission.marketCount}</dd></div>
        <div><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><Users className="size-4" aria-hidden="true" /> Participants</dt><dd className="mt-2 font-mono text-lg text-ink">{mission.operatorCount}</dd></div>
        <div><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><CalendarDays className="size-4" aria-hidden="true" /> Window</dt><dd className="mt-2 text-sm leading-6 text-ink">{formatDate(mission.startsAt)}<br />{formatDate(mission.endsAt)}</dd></div>
      </dl>

      <div className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink"><Radio className="size-4 text-primary" aria-hidden="true" /> Market roster</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {mission.markets.map((market) => <span key={market.id} className="border border-line bg-canvas px-3 py-2 font-mono text-sm text-ink">{market.symbol}</span>)}
        </div>
      </div>

      {error && <p className="mt-6 border border-danger/40 bg-danger/5 p-3 text-sm text-danger" role="alert">{error}</p>}
      <button type="button" onClick={onDeploy} disabled={!deployable || deploying} aria-busy={deploying} className="app-button focus-ring mt-8 min-h-11 bg-primary px-6 text-sm font-semibold uppercase tracking-wider text-primary-ink hover:bg-primary-strong disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">
        {deploying ? 'Deploying…' : deployable ? 'Deploy' : 'Deployment closed'}
      </button>
    </section>
  )
}
