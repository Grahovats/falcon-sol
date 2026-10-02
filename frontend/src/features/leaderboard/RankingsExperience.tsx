import { Activity, Award, ChevronRight, Crosshair, Medal, RotateCw, Trophy, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getRankings, type MissionRanking, type RankingRow, type RankingsMeta, type RankingsPayload } from '../../api/rankings'
import { PageHeader } from '../../components/PageHeader'
import { formatCurrency, formatDate, formatPercent } from '../../lib/format'
import { StatusBadge } from '../missions/StatusBadge'

type View = 'overall' | 'live' | 'finalized'
type State = { status: 'loading' } | { status: 'success'; data: RankingsPayload; meta: RankingsMeta } | { status: 'error'; message: string }
const views: Array<{ id: View; label: string }> = [{ id: 'overall', label: 'Overall' }, { id: 'live', label: 'Live missions' }, { id: 'finalized', label: 'Finalized' }]

export function RankingsExperience() {
  const [params, setParams] = useSearchParams()
  const requestedView = params.get('view')
  const view: View = requestedView === 'live' || requestedView === 'finalized' ? requestedView : 'overall'
  const [state, setState] = useState<State>({ status: 'loading' })
  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ status: 'loading' })
    try {
      const response = await getRankings(signal)
      setState({ status: 'success', data: response.data, meta: response.meta })
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Rankings could not be loaded.' })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => void load(controller.signal), 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [load])

  const selectView = (next: View) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'overall') nextParams.delete('view')
    else nextParams.set('view', next)
    setParams(nextParams, { replace: true })
  }

  return <div>
    <PageHeader title="Rankings" description="Verified operator performance across Falcon paper-trading missions." />
    {state.status === 'loading' && <RankingsLoading />}
    {state.status === 'error' && <ErrorState message={state.message} retry={() => void load()} />}
    {state.status === 'success' && <>
      <dl className="mt-10 grid gap-px bg-line sm:grid-cols-3">
        <Metric icon={<Users />} label="Ranked operators" value={String(state.meta.rankedOperatorCount)} />
        <Metric icon={<Trophy />} label="Finalized missions" value={String(state.meta.finalizedMissionCount)} />
        <Metric icon={<Activity />} label="Live missions" value={String(state.data.liveMissions.length)} />
      </dl>
      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Ranking views">
        {views.map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => selectView(item.id)} className={`focus-ring min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold ${view === item.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}>{item.label}</button>)}
      </div>
      <div className="mt-6">
        {view === 'overall' && <OverallRankings rows={state.data.overall} />}
        {view === 'live' && <MissionRankings missions={state.data.liveMissions} kind="live" />}
        {view === 'finalized' && <MissionRankings missions={state.data.finalizedMissions} kind="finalized" />}
      </div>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted">Updated {formatDate(state.meta.generatedAt)} · Average return determines overall rank</p>
    </>}
  </div>
}

function OverallRankings({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) return <EmptyState title="No career rankings yet" description="Overall standings activate when the first mission is finalized." />
  return <section aria-labelledby="overall-rankings-title">
    <h2 id="overall-rankings-title" className="sr-only">Overall operator rankings</h2>
    <div className="hidden overflow-x-auto border border-line bg-surface md:block">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-muted"><tr><th className="px-5 py-3 font-normal">Rank</th><th className="px-5 py-3 font-normal">Operator</th><th className="px-5 py-3 text-right font-normal">Missions</th><th className="px-5 py-3 text-right font-normal">Wins</th><th className="px-5 py-3 text-right font-normal">Podiums</th><th className="px-5 py-3 text-right font-normal">Avg return</th><th className="px-5 py-3 text-right font-normal">Best</th><th className="px-5 py-3 text-right font-normal">Total P&amp;L</th></tr></thead>
        <tbody className="divide-y divide-line">{rows.map((row) => <tr key={row.userId} className="hover:bg-canvas/60"><td className="px-5 py-4"><Rank rank={row.rank} /></td><td className="px-5 py-4"><OperatorLink userId={row.userId} name={row.displayName} wallet={row.wallet} /></td><td className="px-5 py-4 text-right font-mono text-muted">{row.missionsPlayed}</td><td className="px-5 py-4 text-right font-mono text-ink">{row.wins}</td><td className="px-5 py-4 text-right font-mono text-ink">{row.podiums}</td><ReturnCell value={row.averageReturn} /><ReturnCell value={row.bestReturn} /><CurrencyCell value={row.totalPnl} /></tr>)}</tbody>
      </table>
    </div>
    <div className="grid gap-3 md:hidden">{rows.map((row) => <article key={row.userId} className="border border-line bg-surface p-4"><div className="flex items-center gap-3"><Rank rank={row.rank} /><div className="min-w-0 flex-1"><OperatorLink userId={row.userId} name={row.displayName} wallet={row.wallet} /></div></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4"><CompactMetric label="Average return" value={formatPercent(row.averageReturn)} positive={Number(row.averageReturn) >= 0} /><CompactMetric label="Total P&L" value={formatCurrency(row.totalPnl)} positive={Number(row.totalPnl) >= 0} /><CompactMetric label="Missions" value={String(row.missionsPlayed)} /><CompactMetric label="Wins / podiums" value={`${row.wins} / ${row.podiums}`} /></dl></article>)}</div>
  </section>
}

function MissionRankings({ missions, kind }: { missions: MissionRanking[]; kind: 'live' | 'finalized' }) {
  if (missions.length === 0) return <EmptyState title={kind === 'live' ? 'No missions are live' : 'No finalized missions'} description={kind === 'live' ? 'Open or scheduled operations are available on the mission board.' : 'Completed operation results will appear here permanently.'} />
  return <div className="grid gap-5">{missions.map((mission) => <section key={mission.id} className="border border-line bg-surface" aria-labelledby={`mission-ranking-${mission.id}`}><header className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-3"><h2 id={`mission-ranking-${mission.id}`} className="font-semibold text-ink">{mission.name}</h2><StatusBadge status={mission.status} /></div><p className="mt-2 font-mono text-xs text-muted">{mission.operatorCount} operators · {kind === 'live' ? `Ends ${formatDate(mission.endsAt)}` : `Finalized ${formatDate(mission.endsAt)}`}</p></div><Link to={`/missions/${mission.id}`} className="focus-ring inline-flex min-h-11 items-center gap-2 self-start px-1 text-sm font-semibold text-primary">Open mission <ChevronRight className="size-4" /></Link></header>{mission.hidden ? <div className="p-8 text-center"><Crosshair className="mx-auto size-6 text-primary" /><p className="mt-3 font-semibold text-ink">Standings under blackout</p><p className="mt-2 text-sm text-muted">Ranks are concealed until settlement to protect the final trading window.</p></div> : mission.rows.length === 0 ? <p className="p-8 text-center text-sm text-muted">No operators have established a ranking in this mission.</p> : <div className="divide-y divide-line">{mission.rows.map((row) => <div key={row.userId} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-5"><Rank rank={row.rank} /><OperatorLink userId={row.userId} name={row.displayName} wallet={row.wallet} /><div className="text-right"><p className={`font-mono text-sm ${Number(row.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(row.returnPercent)}</p><p className="mt-1 font-mono text-xs text-muted">{formatCurrency(row.equity)}</p></div></div>)}</div>}</section>)}</div>
}

function OperatorLink({ userId, name, wallet }: { userId: string; name: string; wallet: string | null }) { return <Link to={`/operators/${userId}`} className="focus-ring block min-h-10 rounded-sm py-1 hover:text-primary"><span className="block truncate font-semibold text-ink">{name}</span>{wallet && <span className="mt-0.5 block font-mono text-[11px] text-muted">{wallet.slice(0, 4)}…{wallet.slice(-4)}</span>}</Link> }
function Rank({ rank }: { rank: number }) { const Icon = rank === 1 ? Trophy : rank <= 3 ? Medal : null; return <span className={`inline-flex size-9 items-center justify-center font-mono text-sm ${rank <= 3 ? 'border border-primary/50 bg-primary/10 text-primary' : 'text-muted'}`}>{Icon ? <Icon className="size-4" aria-label={`Rank ${rank}`} /> : `#${rank}`}</span> }
function ReturnCell({ value }: { value: string }) { return <td className={`px-5 py-4 text-right font-mono ${Number(value) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(value)}</td> }
function CurrencyCell({ value }: { value: string }) { return <td className={`px-5 py-4 text-right font-mono ${Number(value) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatCurrency(value)}</td> }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="bg-surface p-5"><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"><span className="[&>svg]:size-4">{icon}</span>{label}</dt><dd className="mt-3 font-mono text-2xl text-ink">{value}</dd></div> }
function CompactMetric({ label, value, positive }: { label: string; value: string; positive?: boolean }) { return <div><dt className="text-[11px] uppercase tracking-wider text-muted">{label}</dt><dd className={`mt-1 font-mono text-sm ${positive === undefined ? 'text-ink' : positive ? 'text-primary' : 'text-danger'}`}>{value}</dd></div> }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="border border-dashed border-line bg-surface p-10 text-center"><Award className="mx-auto size-7 text-muted" /><h2 className="mt-4 font-semibold text-ink">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p><Link to="/missions" className="focus-ring mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-primary">View mission board <ChevronRight className="ml-2 size-4" /></Link></div> }
function RankingsLoading() { return <div className="mt-10" aria-busy="true" aria-label="Loading rankings"><div className="grid gap-px bg-line sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse bg-surface" />)}</div><div className="mt-8 h-12 animate-pulse bg-surface" /><div className="mt-6 h-96 animate-pulse border border-line bg-surface" /></div> }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="mt-10 border border-danger/40 bg-surface p-8"><h2 className="font-semibold text-ink">Rankings unavailable</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{message}</p><button type="button" onClick={retry} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 border border-line px-4 text-sm font-semibold text-ink hover:border-primary"><RotateCw className="size-4" /> Retry</button></div> }
