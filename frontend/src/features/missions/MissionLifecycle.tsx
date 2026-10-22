import { ArrowLeft, ArrowUpRight, Check, Clock3, ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Mission } from '../../types/mission'
import { formatCurrency } from '../../lib/format'
import { PrizePanel } from './PrizePanel'

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
})

export function MissionLifecycle({ mission }: { mission: Mission }) {
  const cancelled = mission.status === 'CANCELLED'
  const Icon = cancelled ? ShieldX : Clock3
  return (
    <div className="mx-auto w-full max-w-5xl py-4 sm:py-8">
      <Link to="/missions" className="focus-ring inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" /> All missions
      </Link>
      <header className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted">{mission.rewards ? 'Prize mission' : 'Practice mission'}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{mission.name}</h1>
        </div>
        <span className="inline-flex items-center gap-2 border border-line bg-surface px-3 py-2 text-xs font-medium text-muted">
          <Icon size={14} aria-hidden="true" /> {cancelled ? 'Cancelled' : 'Trading closed'}
        </span>
      </header>
      <div className="grid border-b border-line md:grid-cols-[minmax(0,1fr)_280px]">
        <section className="py-8 sm:py-12 md:pr-10" aria-labelledby="mission-lifecycle-title">
          <div className="mb-6 flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/5 text-primary">
            <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h2 id="mission-lifecycle-title" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {cancelled ? 'This mission was cancelled.' : 'Mission ended. Results pending.'}
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-muted">
            {cancelled
              ? 'Trading is closed and no final ranking will be awarded for this mission.'
              : 'The trading window has closed. Final standings will appear here once settlement is complete.'}
          </p>
          {!cancelled && <p className="mt-3 text-xs leading-6 text-muted">This page checks for results automatically. You can leave and return later.</p>}
          <Link to="/missions" className="app-button focus-ring mt-8 inline-flex min-h-11 items-center justify-center gap-3 rounded-sm bg-primary px-5 text-sm font-semibold text-primary-ink">
            Explore missions <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </section>
        <aside className="border-t border-line py-6 md:border-l md:border-t-0 md:py-10 md:pl-8" aria-label="Mission summary">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted">Mission summary</h2>
          <dl className="mt-6 space-y-6 text-sm">
            <div><dt className="text-muted">{cancelled ? 'Scheduled end' : 'Trading ended'}</dt><dd className="mt-2 leading-6 text-ink"><time dateTime={mission.endsAt}>{dateFormat.format(new Date(mission.endsAt))}</time></dd></div>
            <div><dt className="text-muted">Operators</dt><dd className="mt-2 tabular-nums text-ink">{mission.operatorCount}</dd></div>
            <div><dt className="text-muted">Starting virtual capital</dt><dd className="mt-2 tabular-nums text-ink">{formatCurrency(mission.startingBalance)}</dd></div>
          </dl>
          {!mission.rewards && <p className="mt-6 border-t border-line pt-4 text-xs leading-6 text-muted">Free entry · Virtual capital only<br />No cash prize</p>}
        </aside>
      </div>
      {!cancelled && <ol className="grid gap-5 py-6 text-sm sm:grid-cols-3" aria-label="Mission progress">
        <li className="flex items-center gap-3 text-muted"><Check size={16} className="text-primary" aria-hidden="true" /> Trading closed</li>
        <li aria-current="step" className="flex items-center gap-3 text-ink"><Clock3 size={16} className="text-primary" aria-hidden="true" /> Settlement pending</li>
        <li className="flex items-center gap-3 text-muted"><span className="size-4 rounded-full border border-line" aria-hidden="true" /> Final standings</li>
      </ol>}
      {mission.rewards && <div className="mt-6"><PrizePanel mission={mission} /></div>}
    </div>
  )
}
