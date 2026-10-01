import { AlertTriangle, Radar } from 'lucide-react'
import { MissionCard } from './MissionCard'
import { useMissions } from './useMissions'

export function MissionsGrid() {
  const { state, retry } = useMissions()
  if (state.status === 'loading') return <div className="grid gap-5 md:grid-cols-2" aria-busy="true" aria-label="Loading missions">{[0, 1].map((item) => <div key={item} className="h-96 animate-pulse border border-line bg-surface" />)}</div>
  if (state.status === 'error') return <div className="border border-danger/40 bg-danger/5 p-6" role="alert"><AlertTriangle className="size-5 text-danger" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold text-ink">Mission feed unavailable</h2><p className="mt-2 text-sm text-muted">{state.message} Check that the API and database are running.</p><button type="button" onClick={retry} className="focus-ring mt-5 min-h-11 border border-line px-4 text-sm font-medium text-ink hover:border-primary">Retry connection</button></div>
  if (state.missions.length === 0) return <div className="border border-line bg-surface p-8 text-center"><Radar className="mx-auto size-8 text-primary" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold text-ink">No missions on radar</h2><p className="mt-2 text-sm text-muted">Command has not scheduled the next competition yet.</p></div>
  const sections = [
    { title: 'Live operations', statuses: ['ACTIVE', 'BLACKOUT'] },
    { title: 'Upcoming missions', statuses: ['DRAFT', 'REGISTRATION', 'LOCKED'] },
    { title: 'Completed missions', statuses: ['SETTLING', 'FINALIZED', 'CLOSED', 'CANCELLED'] },
  ] as const
  return <div className="space-y-10">{sections.map((section) => { const missions = state.missions.filter((mission) => (section.statuses as readonly string[]).includes(mission.status)); return <section key={section.title} aria-labelledby={section.title.replaceAll(' ', '-').toLowerCase()}><div className="mb-4 flex items-center gap-3"><h2 id={section.title.replaceAll(' ', '-').toLowerCase()} className="text-sm font-semibold uppercase tracking-[0.18em] text-ink">{section.title}</h2><span className="font-mono text-xs text-muted">{missions.length.toString().padStart(2, '0')}</span></div>{missions.length === 0 ? <div className="border border-dashed border-line p-5 text-sm text-muted">No missions in this sector.</div> : <div className="grid gap-5 md:grid-cols-2">{missions.map((mission) => <MissionCard key={mission.id} mission={mission} />)}</div>}</section> })}</div>
}
