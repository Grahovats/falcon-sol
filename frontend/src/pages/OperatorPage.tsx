import { ArrowLeft, Award, Crosshair, Medal, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOperator, type OperatorSummary } from '../api/rankings'
import { PageHeader } from '../components/PageHeader'
import { SolanaAccountIcon } from '../components/SolanaAccountIcon'
import { formatCurrency, formatDate, formatPercent } from '../lib/format'

type State = { status: 'loading' } | { status: 'success'; data: OperatorSummary } | { status: 'error'; message: string }

export function OperatorPage() {
  const { userId = '' } = useParams()
  const [state, setState] = useState<State>({ status: 'loading' })
  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ status: 'loading' })
    try {
      const { data } = await getOperator(userId, signal)
      setState({ status: 'success', data })
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Participant record could not be loaded.' })
    }
  }, [userId])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => void load(controller.signal), 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [load])

  if (state.status === 'loading') return <div aria-busy="true"><PageHeader title="Loading record" /><div className="mt-10 h-80 animate-pulse border border-line bg-surface" /></div>
  if (state.status === 'error') return <div><Link to="/rankings" className="focus-ring mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Back to rankings</Link><PageHeader title="Record unavailable" /><p className="mt-6 text-sm text-danger" role="alert">{state.message}</p><button type="button" onClick={() => void load()} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 border border-line px-4 text-sm font-semibold text-ink hover:border-primary"><RotateCw className="size-4" /> Retry</button></div>

  const profile = state.data
  return <div className="state-content">
    <Link to="/rankings" className="focus-ring mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Back to rankings</Link>
    <header className="flex items-center gap-4 border-b border-line pb-5">
      <SolanaAccountIcon address={profile.wallet ?? profile.userId} size="lg" />
      <div className="min-w-0"><h1 className="truncate text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">{profile.username}</h1><p className="mt-1 truncate font-mono text-xs text-muted">{profile.wallet ? `${profile.wallet.slice(0, 6)}...${profile.wallet.slice(-6)}` : 'Solana participant'}</p></div>
    </header>
    <dl className="mt-10 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-5">
      <Metric icon={<Crosshair />} label="Finalized missions" value={String(profile.missionsEntered)} />
      <Metric icon={<Award />} label="Wins" value={String(profile.wins)} />
      <Metric icon={<Medal />} label="Podium finishes" value={String(profile.topThreeFinishes)} />
      <Metric label="Average return" value={formatPercent(profile.averageReturn)} tone={Number(profile.averageReturn)} />
      <Metric label="Best result" value={profile.bestResult ? `#${profile.bestResult.rank} · ${formatPercent(profile.bestResult.returnPercent)}` : '—'} />
    </dl>
    <section className="mt-8 border border-line bg-surface" aria-labelledby="operator-results-title">
      <div className="border-b border-line px-5 py-4"><h2 id="operator-results-title" className="text-sm font-semibold uppercase tracking-wider text-ink">Finalized mission record</h2></div>
      {profile.results.length === 0 ? <p className="p-8 text-center text-sm text-muted">This participant has no finalized mission results yet.</p> : <>
        <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-muted"><tr><th className="px-5 py-3 font-normal">Mission</th><th className="px-5 py-3 font-normal">Rank</th><th className="px-5 py-3 font-normal">Final equity</th><th className="px-5 py-3 font-normal">Return</th><th className="px-5 py-3 font-normal">Settled</th></tr></thead><tbody className="divide-y divide-line">{profile.results.map((result) => <tr key={result.missionId}><td className="px-5 py-4"><Link to={`/missions/${result.missionId}`} className="focus-ring inline-flex min-h-10 items-center font-semibold text-ink hover:text-primary">{result.missionName}</Link></td><td className="px-5 py-4 font-mono text-muted">#{result.rank}</td><td className="px-5 py-4 font-mono text-ink">{formatCurrency(result.equity)}</td><td className={`px-5 py-4 font-mono ${Number(result.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(result.returnPercent)}</td><td className="px-5 py-4 font-mono text-xs text-muted">{formatDate(result.settledAt)}</td></tr>)}</tbody></table></div>
        <div className="divide-y divide-line sm:hidden">{profile.results.map((result) => <article key={result.missionId} className="p-4"><div className="flex items-start justify-between gap-4"><Link to={`/missions/${result.missionId}`} className="focus-ring min-h-10 font-semibold text-ink hover:text-primary">{result.missionName}</Link><span className="font-mono text-primary">#{result.rank}</span></div><dl className="mt-3 grid grid-cols-2 gap-3"><div><dt className="text-[11px] uppercase tracking-wider text-muted">Final equity</dt><dd className="mt-1 font-mono text-sm text-ink">{formatCurrency(result.equity)}</dd></div><div><dt className="text-[11px] uppercase tracking-wider text-muted">Return</dt><dd className={`mt-1 font-mono text-sm ${Number(result.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(result.returnPercent)}</dd></div></dl></article>)}</div>
      </>}
    </section>
  </div>
}

function Metric({ icon, label, value, tone }: { icon?: React.ReactNode; label: string; value: string; tone?: number }) {
  return <div className="bg-surface p-5"><dt className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">{icon && <span className="[&>svg]:size-4">{icon}</span>}{label}</dt><dd className={`mt-3 font-mono text-2xl ${tone === undefined ? 'text-ink' : tone >= 0 ? 'text-primary' : 'text-danger'}`}>{value}</dd></div>
}
