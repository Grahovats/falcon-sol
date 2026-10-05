import { AlertTriangle, Radar } from 'lucide-react'
import { useState } from 'react'
import type { Mission } from '../../types/mission'
import { MissionCard } from './MissionCard'
import { useMissions } from './useMissions'

type Filter = 'ALL' | 'LIVE' | 'UPCOMING' | 'COMPLETED'

const filters: { label: string; value: Filter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Upcoming', value: 'UPCOMING' },
  { label: 'Completed', value: 'COMPLETED' },
]

const groups = [
  { title: 'Live operations', statuses: ['ACTIVE', 'BLACKOUT'] },
  { title: 'Upcoming missions', statuses: ['DRAFT', 'REGISTRATION', 'LOCKED'] },
  { title: 'Completed missions', statuses: ['SETTLING', 'FINALIZED', 'CLOSED', 'CANCELLED'] },
] as const

export function MissionsGrid() {
  const { state, retry } = useMissions()
  const [filter, setFilter] = useState<Filter>('ALL')

  if (state.status === 'loading') return <MissionsSkeleton />
  if (state.status === 'error') return <div className="rounded-xl border border-danger/40 bg-danger/5 p-6" role="alert"><AlertTriangle className="size-5 text-danger" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold text-ink">Mission feed unavailable</h2><p className="mt-2 text-sm text-muted">{state.message} Check that the API and database are running.</p><button type="button" onClick={retry} className="focus-ring mt-5 min-h-11 rounded-md border border-line px-4 text-sm font-medium text-ink hover:border-primary">Retry connection</button></div>
  if (state.missions.length === 0) return <div className="rounded-xl border border-line bg-surface p-8 text-center"><Radar className="mx-auto size-8 text-primary" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold text-ink">No missions on radar</h2><p className="mt-2 text-sm text-muted">Command has not scheduled the next competition yet.</p></div>

  const visibleGroups = filter === 'ALL' ? groups : groups.filter((group) => group.title.startsWith(filter === 'LIVE' ? 'Live' : filter === 'UPCOMING' ? 'Upcoming' : 'Completed'))
  const liveCount = state.missions.filter((mission) => isInGroup(mission, groups[0].statuses)).length

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter missions">
          {filters.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} aria-pressed={filter === item.value} className={`focus-ring min-h-10 rounded-md border px-4 text-xs font-medium motion-safe:transition-colors motion-safe:duration-100 ${filter === item.value ? 'border-primary/40 bg-primary/10 text-primary' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'}`}>{item.label}</button>)}
        </div>
        <p className="flex items-center gap-2 font-mono text-xs text-muted"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />{liveCount} live {liveCount === 1 ? 'operation' : 'operations'}</p>
      </div>

      <div key={filter} className="state-content mt-8 space-y-12">
        {visibleGroups.map((group) => {
          const missions = state.missions.filter((mission) => isInGroup(mission, group.statuses))
          const id = group.title.replaceAll(' ', '-').toLowerCase()
          return (
            <section key={group.title} aria-labelledby={id}>
              <div className="mb-4 flex items-center gap-3"><h2 id={id} className="text-sm font-semibold text-ink">{group.title}</h2><span className="font-mono text-xs text-muted">{missions.length.toString().padStart(2, '0')}</span></div>
              {missions.length === 0 ? <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">No missions in this sector.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{missions.map((mission, index) => <MissionCard key={mission.id} mission={mission} entranceIndex={index} />)}</div>}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function isInGroup(mission: Mission, statuses: readonly string[]) {
  return statuses.includes(mission.status)
}

function MissionsSkeleton() {
  return <div aria-busy="true" aria-label="Loading missions"><div className="h-12 animate-pulse border-b border-line bg-surface" /><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-96 animate-pulse rounded-xl border border-line bg-surface" />)}</div></div>
}
