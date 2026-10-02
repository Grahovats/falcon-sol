import { Award, RotateCw, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfile, type ProfileSummary } from '../api/profile'
import { AuthenticationRequired } from '../components/AuthenticationRequired'
import { formatCurrency, formatPercent } from '../lib/format'
import { useAuth } from '../providers/auth-context'

type State = { status: 'loading' } | { status: 'success'; data: ProfileSummary } | { status: 'error'; message: string }

export function ProfilePage() {
  const auth = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })
  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ status: 'loading' })
    try {
      const { data } = await getProfile(signal)
      setState({ status: 'success', data })
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Profile could not be loaded.' })
    }
  }, [])

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const controller = new AbortController()
    const timer = window.setTimeout(() => void load(controller.signal), 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [auth.status, auth.user?.userId, load])

  if (auth.status === 'loading' || auth.status === 'signing') return <ProfileSkeleton />
  if (auth.status !== 'authenticated') return <AuthenticationRequired title="Authenticate to view your dossier" />
  if (state.status === 'loading') return <ProfileSkeleton />
  if (state.status === 'error') return <ProfileError message={state.message} retry={() => void load()} />

  const profile = state.data
  const winRate = profile.missionsEntered ? Math.round((profile.wins / profile.missionsEntered) * 100) : 0
  const bestReturn = profile.bestResult ? Number(profile.bestResult.returnPercent) : null

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">History &amp; profile</h1>
      </header>

      <section className="accent-panel lime-shine mt-7 grid gap-6 rounded-xl border border-primary/25 p-5 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-center lg:p-6" aria-label="Operator summary">
        <div className="flex min-w-0 items-center gap-4">
          <div className="operator-avatar grid size-14 shrink-0 place-items-center rounded-full border border-primary/50 font-mono text-lg font-bold text-primary-ink" aria-hidden="true">{initials(profile.username)}</div>
          <div className="min-w-0"><h2 className="truncate text-base font-semibold text-ink">{profile.username}</h2><p className="mt-1 truncate font-mono text-xs text-muted">{profile.wallet ? `${profile.wallet.slice(0, 6)}...${profile.wallet.slice(-6)}` : 'Authenticated Falcon operator'}</p></div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-5">
          <ProfileMetric label="Missions" value={String(profile.missionsEntered)} />
          <ProfileMetric label="Wins" value={String(profile.wins)} accent />
          <ProfileMetric label="Win rate" value={`${winRate}%`} accent />
          <ProfileMetric label="Best return" value={bestReturn === null ? '—' : formatPercent(bestReturn)} positive={bestReturn !== null && bestReturn >= 0} />
          <ProfileMetric label="Avg return" value={formatPercent(profile.averageReturn)} positive={Number(profile.averageReturn) >= 0} className="col-span-2 sm:col-span-1" />
        </dl>
      </section>

      <div className="mt-6 border-b border-line">
        <span className="inline-flex min-h-11 items-center border-b-2 border-primary px-1 text-sm font-medium text-primary">Mission history</span>
      </div>

      <section className="lime-shine mt-4 overflow-hidden rounded-xl border border-line bg-surface" aria-labelledby="records-title">
        <div className="sr-only"><h2 id="records-title">Mission history</h2></div>
        {profile.results.length === 0 ? (
          <div className="px-6 py-14 text-center"><Trophy className="mx-auto size-7 text-primary" aria-hidden="true" /><h3 className="mt-4 text-lg font-semibold text-ink">No mission history yet</h3><p className="mt-2 text-sm text-muted">Deploy into a mission to establish your operator record.</p><Link to="/missions" className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-ink">Browse missions</Link></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-line bg-surface-raised font-mono text-[10px] uppercase tracking-[0.14em] text-muted"><tr><th className="px-5 py-3.5 font-normal">Mission</th><th className="px-5 py-3.5 font-normal">Return</th><th className="px-5 py-3.5 font-normal">Rank</th><th className="px-5 py-3.5 font-normal">Final equity</th><th className="px-5 py-3.5 font-normal">Finish</th></tr></thead>
              <tbody className="divide-y divide-line">
                {profile.results.map((result) => {
                  const podium = result.rank !== null && result.rank <= 3
                  const positive = Number(result.returnPercent) >= 0
                  return <tr key={result.missionId} className="motion-safe:transition-colors motion-safe:duration-100 hover:bg-primary/5"><td className="px-5 py-4"><Link to={`/missions/${result.missionId}`} className="focus-ring inline-flex min-h-10 items-center font-medium text-ink hover:text-primary">{result.missionName}</Link></td><td className={`px-5 py-4 font-mono font-semibold tabular-nums ${positive ? 'text-primary' : 'text-danger'}`}>{formatPercent(result.returnPercent)}</td><td className="px-5 py-4 font-mono text-muted">{result.rank ? `#${result.rank}` : '—'}</td><td className="px-5 py-4 font-mono text-ink">{formatCurrency(result.equity)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${podium ? 'border-primary/30 bg-primary/10 text-primary' : positive ? 'border-primary/20 bg-primary/5 text-primary' : 'border-danger/30 bg-danger/10 text-danger'}`}>{podium ? 'Podium' : positive ? 'Positive' : 'Negative'}</span></td></tr>
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function ProfileMetric({ label, value, accent = false, positive = false, className = '' }: { label: string; value: string; accent?: boolean; positive?: boolean; className?: string }) {
  return <div className={className}><dt className="text-xs text-muted">{label}</dt><dd className={`mt-1.5 font-mono text-base tabular-nums ${accent || positive ? 'text-primary' : 'text-ink'}`}>{value}</dd></div>
}

function initials(value: string) {
  return value.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'OP'
}

function ProfileSkeleton() {
  return <div className="space-y-6" aria-busy="true" aria-label="Loading profile"><div className="h-20 animate-pulse border-b border-line bg-surface" /><div className="h-32 animate-pulse rounded-xl border border-line bg-surface" /><div className="h-80 animate-pulse rounded-xl border border-line bg-surface" /></div>
}

function ProfileError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="rounded-xl border border-danger/40 bg-danger/5 p-6" role="alert"><Award className="size-5 text-danger" aria-hidden="true" /><h1 className="mt-4 text-xl font-semibold text-ink">Profile unavailable</h1><p className="mt-2 text-sm text-muted">{message}</p><button type="button" onClick={retry} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm text-ink hover:border-primary"><RotateCw className="size-4" aria-hidden="true" />Retry</button></div>
}
