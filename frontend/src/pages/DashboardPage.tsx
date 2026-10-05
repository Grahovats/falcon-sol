import { Activity, ArrowRight, ArrowUpRight, Award, ChevronLeft, ChevronRight, Crosshair, RotateCw, Target } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { getProfile, type ProfileResult, type ProfileSummary } from '../api/profile'
import { getMarkets, getOrders, getPortfolio } from '../api/trading'
import { AuthenticationRequired } from '../components/AuthenticationRequired'
import { useMissions } from '../features/missions/useMissions'
import { useCountdown } from '../hooks/useCountdown'
import { formatCurrency, formatPercent } from '../lib/format'
import { useAuth } from '../providers/auth-context'
import type { Mission } from '../types/mission'
import type { MarketPrice, OrderHistoryItem, Portfolio } from '../types/trading'

type ProfileState = { status: 'loading' } | { status: 'success'; data: ProfileSummary } | { status: 'error'; message: string }
interface EnrolledMission { mission: Mission; portfolio: Portfolio }
type EnrollmentState = { status: 'loading' } | { status: 'success'; data: EnrolledMission[] } | { status: 'error'; message: string }
type PerformanceRange = '24H' | '7D' | 'ALL'

export function DashboardPage() {
  const auth = useAuth()
  const missions = useMissions()
  const [profile, setProfile] = useState<ProfileState>({ status: 'loading' })
  const [enrollment, setEnrollment] = useState<EnrollmentState>({ status: 'loading' })
  const [selectedViewIndex, setSelectedViewIndex] = useState(0)

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    setProfile({ status: 'loading' })
    try {
      const { data } = await getProfile(signal)
      setProfile({ status: 'success', data })
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setProfile({ status: 'error', message: error instanceof Error ? error.message : 'Dashboard could not be loaded.' })
    }
  }, [])

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const controller = new AbortController()
    const timer = window.setTimeout(() => void loadProfile(controller.signal), 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [auth.status, auth.user?.userId, loadProfile])

  useEffect(() => {
    if (auth.status !== 'authenticated' || missions.state.status !== 'success') return
    const controller = new AbortController()
    const candidates = missions.state.missions.filter((mission) => ['REGISTRATION', 'LOCKED', 'ACTIVE', 'BLACKOUT'].includes(mission.status))
    const timer = window.setTimeout(() => {
      setEnrollment({ status: 'loading' })
      Promise.all(candidates.map(async (mission) => {
        try {
          const { data } = await getPortfolio(mission.id, controller.signal)
          return { mission, portfolio: data }
        } catch (error: unknown) {
          if (error instanceof ApiError && error.code === 'MISSION_ENTRY_NOT_FOUND') return null
          throw error
        }
      })).then((entries) => {
        setSelectedViewIndex(0)
        setEnrollment({ status: 'success', data: entries.filter((entry): entry is EnrolledMission => entry !== null) })
      }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setEnrollment({ status: 'error', message: error instanceof Error ? error.message : 'Joined missions could not be loaded.' })
      })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [auth.status, auth.user?.userId, missions.state])

  if (auth.status === 'loading' || auth.status === 'signing') return <DashboardSkeleton />
  if (auth.status !== 'authenticated') return <AuthenticationRequired title="Authenticate to open your dashboard" />
  if (profile.status === 'loading') return <DashboardSkeleton />
  if (profile.status === 'error') return <DashboardError message={profile.message} retry={() => void loadProfile()} />

  const enrolledMissions = enrollment.status === 'success' ? enrollment.data : []
  const previousResults = profile.data.results
  const hasEmptyCurrentSlot = enrolledMissions.length === 0
  const historyOffset = enrolledMissions.length + (hasEmptyCurrentSlot ? 1 : 0)
  const totalMissionViews = historyOffset + previousResults.length
  const currentMission = enrolledMissions[selectedViewIndex]
  const previousMission = selectedViewIndex >= historyOffset ? previousResults[selectedViewIndex - historyOffset] : undefined
  const { missionsEntered, wins } = profile.data
  const showPrevious = () => setSelectedViewIndex((index) => totalMissionViews ? (index - 1 + totalMissionViews) % totalMissionViews : 0)
  const showNext = () => setSelectedViewIndex((index) => totalMissionViews ? (index + 1) % totalMissionViews : 0)

  return (
    <div className="state-content w-full">
      <header className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">Your command center<span className="text-primary">.</span></h1>
          <p className="mt-3 text-sm text-muted">Welcome back, {profile.data.username}. Make your next move count.</p>
        </div>
        <Link to="/missions" className="directional-action focus-ring inline-flex min-h-11 w-fit items-center gap-6 rounded-md border border-line-strong px-5 text-sm font-semibold text-ink hover:border-primary hover:text-primary">Find a mission <ArrowRight className="action-icon size-4" aria-hidden="true" /></Link>
      </header>

      <dl className="dashboard-metrics grid grid-cols-2 border-b border-line md:grid-cols-3 xl:grid-cols-6">
        <SummaryMetric label="Missions" value={String(missionsEntered)} note={`${enrolledMissions.length} active`} />
        <SummaryMetric label="Wins" value={String(wins)} note="First-place finishes" />
        <SummaryMetric label="Podiums" value={String(profile.data.topThreeFinishes)} note="Top-three finishes" />
        <SummaryMetric label="Avg return" value={formatPercent(profile.data.averageReturn)} note="Across finalized missions" positive={Number(profile.data.averageReturn) >= 0} />
        <SummaryMetric label="Best result" value={profile.data.bestResult ? formatPercent(profile.data.bestResult.returnPercent) : '—'} note={profile.data.bestResult?.missionName ?? 'No finalized result'} positive={Boolean(profile.data.bestResult && Number(profile.data.bestResult.returnPercent) >= 0)} />
        <SummaryMetric label="Win rate" value={missionsEntered ? `${((wins / missionsEntered) * 100).toFixed(1)}%` : '—'} note={`${wins} of ${missionsEntered} missions`} />
      </dl>

      <div className="dashboard-primary-grid mt-7">
        <div className="min-w-0">
          {enrollment.status === 'loading'
            ? <MissionPanelSkeleton />
            : enrollment.status === 'error'
              ? <EnrollmentError message={enrollment.message} retry={missions.retry} />
              : currentMission
                ? <CurrentMission entry={currentMission} index={selectedViewIndex} total={totalMissionViews} onPrevious={showPrevious} onNext={showNext} />
                : previousMission
                  ? <PreviousMission result={previousMission} index={selectedViewIndex} total={totalMissionViews} onPrevious={showPrevious} onNext={showNext} />
                  : <NoActiveMission index={selectedViewIndex} total={totalMissionViews} onPrevious={showPrevious} onNext={showNext} />}
        </div>
        <div className="min-w-0">
          <PortfolioPerformancePanel profile={profile.data} entry={currentMission} historicalResult={previousMission} />
        </div>
      </div>

      <RecentResults results={profile.data.results} />
    </div>
  )
}

function SummaryMetric({ label, value, note, positive = false }: { label: string; value: string; note: string; positive?: boolean }) {
  return <div className="dashboard-metric min-w-0 px-4 py-5 first:pl-0 xl:py-6"><dt className="text-xs text-muted">{label}</dt><dd className={`mt-2 font-mono text-2xl font-semibold tracking-[-0.04em] tabular-nums ${positive ? 'text-primary' : 'text-ink'}`}>{value}</dd><p className="mt-2 truncate text-xs text-muted">{note}</p></div>
}

function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-5 sm:px-6"><h2 className="text-sm font-semibold text-ink">{title}</h2>{children}</div>
}

function MissionNavigator({ index, total, onPrevious, onNext }: { index: number; total: number; onPrevious: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-1" aria-label="Mission history navigation">
      <button type="button" onClick={onPrevious} disabled={total < 2} className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted hover:bg-surface-raised hover:text-primary disabled:cursor-default disabled:opacity-30" aria-label="Show previous mission"><ChevronLeft className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Previous</span></button>
      <span className="min-w-12 text-center font-mono text-xs text-ink" aria-live="polite">{index + 1} / {total}</span>
      <button type="button" onClick={onNext} disabled={total < 2} className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted hover:bg-surface-raised hover:text-primary disabled:cursor-default disabled:opacity-30" aria-label="Show next mission"><span className="hidden sm:inline">Next</span><ChevronRight className="size-4" aria-hidden="true" /></button>
    </div>
  )
}

function CurrentMission({ entry, index, total, onPrevious, onNext }: { entry: EnrolledMission; index: number; total: number; onPrevious: () => void; onNext: () => void }) {
  const { mission, portfolio } = entry
  const live = mission.status === 'ACTIVE' || mission.status === 'BLACKOUT'
  const countdown = useCountdown(live ? mission.endsAt : mission.startsAt)
  const deployedPercent = Math.max(0, Math.min(100, 100 - (Number(portfolio.cashBalance) / Math.max(Number(portfolio.totalEquity), 1)) * 100))
  return (
    <section className="flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface" aria-labelledby="current-mission-title" aria-live="polite">
      <PanelHeader title="Current mission"><MissionNavigator index={index} total={total} onPrevious={onPrevious} onNext={onNext} /></PanelHeader>
      <div className="flex flex-1 flex-col justify-center p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-3"><span className="size-2 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" aria-hidden="true" /><span className="text-xs font-semibold uppercase tracking-widest text-primary">{live ? 'Live operation' : 'Deployment queued'}</span></div>
        <h3 id="current-mission-title" className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-ink">{mission.name}</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">{mission.description ?? 'Mission parameters are live. Review the market roster before opening the terminal.'}</p>
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          <MissionMetric icon={<Crosshair />} label="Equity" value={formatCurrency(portfolio.totalEquity)} />
          <MissionMetric icon={<Activity />} label="Your return" value={formatPercent(portfolio.returnPercent)} positive={Number(portfolio.returnPercent) >= 0} />
          <MissionMetric icon={<Target />} label={live ? 'Time left' : 'Starts in'} value={countdown} fullOnMobile />
        </div>
        <div className="mt-6"><div className="flex items-center justify-between text-xs"><span className="text-muted">Capital deployed</span><span className="font-mono text-primary">{Math.round(deployedPercent)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary" style={{ width: `${deployedPercent}%` }} /></div></div>
        <div className="mt-8 flex flex-wrap gap-3"><Link to={`/missions/${mission.id}`} className="directional-action focus-ring inline-flex min-h-11 items-center gap-5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-ink">Open mission <ArrowRight className="action-icon size-4" aria-hidden="true" /></Link><Link to="/rankings" className="focus-ring inline-flex min-h-11 items-center rounded-md border border-line-strong px-5 text-sm font-medium text-ink hover:border-primary hover:text-primary">Command board</Link></div>
      </div>
    </section>
  )
}

function PreviousMission({ result, index, total, onPrevious, onNext }: { result: ProfileResult; index: number; total: number; onPrevious: () => void; onNext: () => void }) {
  const returnValue = Number(result.returnPercent)
  const finish = result.rank === 1 ? 'Winner' : result.rank && result.rank <= 3 ? 'Podium finish' : 'Mission completed'
  return (
    <section className="flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface" aria-labelledby="previous-mission-title" aria-live="polite">
      <PanelHeader title="Mission history"><MissionNavigator index={index} total={total} onPrevious={onPrevious} onNext={onNext} /></PanelHeader>
      <div className="flex flex-1 flex-col justify-center p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-3"><span className="rounded border border-line-strong bg-surface-raised px-2 py-1 text-xs font-semibold uppercase tracking-widest text-muted">Previous mission</span><span className="text-xs text-muted">{formatResultDate(result.missionDate)}</span></div>
        <h3 id="previous-mission-title" className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-ink">{result.missionName}</h3>
        <p className="mt-3 text-sm leading-6 text-muted">Review your finalized performance, finishing position, and ending equity.</p>
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          <MissionMetric icon={<Activity />} label="Final equity" value={formatCurrency(result.equity)} />
          <MissionMetric icon={<Target />} label="Return" value={formatPercent(returnValue)} positive={returnValue >= 0} />
          <MissionMetric icon={<Crosshair />} label="Final rank" value={result.rank ? `#${result.rank} / ${result.participantCount}` : `— / ${result.participantCount}`} fullOnMobile />
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-line pt-5"><span className="text-sm text-muted">Result</span><span className={`rounded border px-2 py-1 text-xs font-semibold ${result.rank && result.rank <= 3 ? 'border-primary/25 bg-primary/5 text-primary' : 'border-line-strong bg-surface-raised text-ink'}`}>{finish}</span></div>
        <div className="mt-8"><Link to={`/missions/${result.missionId}`} className="directional-action focus-ring inline-flex min-h-11 items-center gap-5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-ink">View mission <ArrowRight className="action-icon size-4" aria-hidden="true" /></Link></div>
      </div>
    </section>
  )
}

function MissionMetric({ icon, label, value, positive = false, fullOnMobile = false }: { icon: React.ReactNode; label: string; value: string; positive?: boolean; fullOnMobile?: boolean }) {
  return <div className={`bg-surface-muted px-4 py-4 ${fullOnMobile ? 'col-span-2 sm:col-span-1' : ''}`}><p className="flex items-center gap-2 text-xs text-muted [&>svg]:size-3.5 [&>svg]:text-primary">{icon}{label}</p><p className={`mt-2 font-mono text-sm font-semibold tabular-nums ${positive ? 'text-primary' : 'text-ink'}`}>{value}</p></div>
}

function NoActiveMission({ index, total, onPrevious, onNext }: { index: number; total: number; onPrevious: () => void; onNext: () => void }) {
  return <section className="flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface" aria-labelledby="current-mission-title"><PanelHeader title="Current mission">{total > 1 ? <MissionNavigator index={index} total={total} onPrevious={onPrevious} onNext={onNext} /> : <span className="font-mono text-xs text-muted">0 / 0</span>}</PanelHeader><div className="grid flex-1 place-items-center px-6 py-12 text-center"><div><Crosshair className="mx-auto size-10 text-primary" strokeWidth={1.75} aria-hidden="true" /><h3 id="current-mission-title" className="mt-6 text-xl font-semibold tracking-[-0.03em] text-ink">Your mission starts here.</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">Join a live mission to activate your command center.<br />Equal capital. Zero financial risk.</p>{total > 1 && <p className="mt-3 text-xs text-primary">Use Previous to review completed missions.</p>}<Link to="/missions" className="directional-action focus-ring mt-7 inline-flex min-h-11 items-center gap-6 rounded-md bg-primary px-5 text-sm font-semibold text-primary-ink">Explore missions <ArrowRight className="action-icon size-4" aria-hidden="true" /></Link></div></div></section>
}

interface EquityPoint { timestamp: number; equity: number }
type PerformanceState = { status: 'loading' } | { status: 'success'; points: EquityPoint[] }

function PortfolioPerformancePanel({ profile, entry, historicalResult }: { profile: ProfileSummary; entry?: EnrolledMission; historicalResult?: ProfileResult }) {
  const [state, setState] = useState<PerformanceState>({ status: 'loading' })
  const [range, setRange] = useState<PerformanceRange>('24H')
  const liveFallbackPoints = useMemo(() => entry ? buildDemoSeries(Number(entry.portfolio.totalEquity), Number(entry.portfolio.startingBalance)) : [], [entry])
  const demoPoints = useMemo(() => {
    const result = historicalResult ?? profile.bestResult ?? profile.results[0]
    const endValue = result ? Number(result.equity) : 12846.5
    return buildDemoSeries(endValue, result ? startingValueForResult(result) : 10000)
  }, [historicalResult, profile.bestResult, profile.results])

  useEffect(() => {
    if (!entry) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setState({ status: 'loading' })
      Promise.all([getMarkets(entry.mission.id, controller.signal), getOrders(entry.mission.id, controller.signal)])
        .then(([markets, orders]) => setState({ status: 'success', points: buildEquitySeries(entry.portfolio, markets.data, orders.data) }))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setState({ status: 'success', points: buildDemoSeries(Number(entry.portfolio.totalEquity), Number(entry.portfolio.startingBalance)) })
        })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [entry, profile.bestResult, profile.results])

  const sourcePoints = useMemo(() => entry ? (state.status === 'success' ? state.points : liveFallbackPoints) : demoPoints, [demoPoints, entry, liveFallbackPoints, state])
  const visiblePoints = useMemo(() => filterPointsForRange(sourcePoints, range), [sourcePoints, range])
  const startValue = entry ? Number(entry.portfolio.startingBalance) : visiblePoints[0]?.equity ?? 10000
  const endValue = entry ? Number(entry.portfolio.totalEquity) : visiblePoints.at(-1)?.equity ?? 12846.5
  const change = endValue - startValue
  const returnPercent = startValue === 0 ? 0 : (change / startValue) * 100
  const positive = change >= 0
  const performanceLabel = entry?.mission.name ?? historicalResult?.missionName ?? profile.bestResult?.missionName ?? 'Sample mission performance'

  return (
    <section className="flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface" aria-labelledby="performance-title">
      <PanelHeader title="Portfolio performance"><div className="flex items-center gap-1" role="group" aria-label="Performance range">{(['24H', '7D', 'ALL'] as const).map((item) => <button key={item} type="button" onClick={() => setRange(item)} aria-pressed={range === item} className={`focus-ring min-h-10 rounded-md px-3 font-mono text-xs font-semibold ${range === item ? 'bg-surface-raised text-primary' : 'text-muted hover:text-ink'}`}>{item}</button>)}</div></PanelHeader>
      <div className="flex-1 px-3 py-5 sm:px-6 sm:py-6"><p className="text-xs text-muted">Historical equity · {entry ? 'live' : historicalResult ? 'finalized' : 'demo'}</p><div className="mt-2 flex flex-wrap items-baseline gap-3"><p className="font-mono text-xl font-semibold tracking-[-0.05em] text-ink sm:text-3xl">{formatCurrency(endValue)}</p><span className={`rounded border px-2 py-1 font-mono text-xs font-semibold ${positive ? 'border-primary/25 bg-primary/5 text-primary' : 'border-danger/30 bg-danger/5 text-danger'}`}>{formatPercent(returnPercent)}</span></div><InteractiveEquityChart points={visiblePoints} positive={positive} label={performanceLabel} /><dl className="mt-5 grid grid-cols-3 divide-x divide-line border-t border-line pt-5"><PerformanceMetric label="Start value" value={formatCurrency(startValue)} /><PerformanceMetric label="Net P&amp;L" value={formatCurrency(change)} positive={positive} /><PerformanceMetric label="Return" value={formatPercent(returnPercent)} positive={positive} /></dl></div>
    </section>
  )
}

function PerformanceMetric({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return <div className="min-w-0 px-3 first:pl-0 last:pr-0"><dt className="text-xs text-muted">{label}</dt><dd className={`mt-2 truncate font-mono text-sm font-semibold tabular-nums sm:text-base ${positive ? 'text-primary' : 'text-ink'}`}>{value}</dd></div>
}

function InteractiveEquityChart({ points, positive, label }: { points: EquityPoint[]; positive: boolean; label: string }) {
  const geometry = useMemo(() => chartGeometry(points), [points])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activePoint = points[activeIndex ?? Math.max(points.length - 1, 0)]
  const activeCoordinate = geometry.coordinates[activeIndex ?? Math.max(points.length - 1, 0)]
  function selectFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!geometry.coordinates.length) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const chartX = Math.max(0, Math.min(560, ((event.clientX - bounds.left) / bounds.width) * 640))
    setActiveIndex(geometry.coordinates.reduce((best, point, index) => Math.abs(point.x - chartX) < Math.abs(geometry.coordinates[best].x - chartX) ? index : best, 0))
  }
  function handleKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    setActiveIndex((current) => Math.max(0, Math.min(points.length - 1, (current ?? points.length - 1) + direction)))
  }
  return (
    <div className={`dashboard-equity-chart focus-ring relative mt-5 touch-none ${positive ? 'text-primary' : 'text-danger'}`} role="img" tabIndex={0} aria-label={`${label} portfolio equity chart. Use left and right arrow keys to inspect values.`} onPointerMove={selectFromPointer} onPointerDown={selectFromPointer} onPointerLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex((current) => current ?? points.length - 1)} onBlur={() => setActiveIndex(null)} onKeyDown={handleKeyboard}>
      <svg viewBox="0 0 640 240" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="equity-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.12" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.02" /></linearGradient></defs>{geometry.ticks.map((tick) => <g key={tick.y}><line x1="0" y1={tick.y} x2="560" y2={tick.y} stroke="var(--color-line)" strokeOpacity="0.75" vectorEffect="non-scaling-stroke" /><text x="580" y={tick.y + 4} fill="var(--color-muted)" fontSize="10" fontFamily="var(--font-mono)">{formatAxisValue(tick.value)}</text></g>)}{[112, 224, 336, 448].map((value) => <line key={value} x1={value} y1="10" x2={value} y2="210" stroke="var(--color-line)" strokeOpacity="0.42" vectorEffect="non-scaling-stroke" />)}<line x1="0" y1={geometry.baselineY} x2="560" y2={geometry.baselineY} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" /><path d={geometry.areaPath} fill="url(#equity-area)" /><path d={geometry.linePath} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />{activeCoordinate && <><line x1={activeCoordinate.x} y1="10" x2={activeCoordinate.x} y2="210" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" /><circle cx={activeCoordinate.x} cy={activeCoordinate.y} r="4" fill="var(--color-surface)" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></>}</svg>
      {activeIndex !== null && activeCoordinate && activePoint && <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-primary/25 bg-surface-raised px-2.5 py-2 shadow-lg shadow-black/30" style={{ left: `${(activeCoordinate.x / 640) * 100}%`, top: `${Math.max(0, (activeCoordinate.y / 240) * 100 - 17)}%` }}><p className="font-mono text-xs font-semibold tabular-nums text-ink">{formatCurrency(activePoint.equity)}</p><p className="mt-1 whitespace-nowrap font-mono text-[10px] text-muted">{formatChartTime(activePoint.timestamp)}</p></div>}
      <div className="absolute inset-x-0 bottom-0 flex justify-between pr-[12.5%] font-mono text-[10px] text-muted"><span>{formatChartLabel(points[0]?.timestamp)}</span><span>{formatChartLabel(points[Math.floor(points.length / 2)]?.timestamp)}</span><span>Now</span></div>
      <span className="sr-only" aria-live="polite">{activeIndex !== null && activePoint ? `${formatCurrency(activePoint.equity)} at ${formatChartTime(activePoint.timestamp)}` : ''}</span>
    </div>
  )
}

function RecentResults({ results }: { results: ProfileResult[] }) {
  return <section className="mt-10" aria-labelledby="recent-results-title"><div className="flex items-center justify-between gap-4"><h2 id="recent-results-title" className="text-xl font-semibold tracking-[-0.03em] text-ink">Recent mission results</h2><Link to="/profile" className="directional-action focus-ring inline-flex min-h-10 items-center gap-4 rounded-md px-2 text-sm font-medium text-ink hover:text-primary">Full history <ArrowRight className="action-icon size-4" aria-hidden="true" /></Link></div><div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">{results.length === 0 ? <div className="px-6 py-12 text-center"><p className="text-sm text-muted">No finalized missions yet.</p><Link to="/missions" className="focus-ring mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary">Explore missions</Link></div> : <table className="w-full min-w-[52rem] border-collapse text-left"><thead><tr className="border-b border-line text-xs text-muted"><th className="px-6 py-4 font-normal">Mission</th><th className="px-4 py-4 font-normal">Return</th><th className="px-4 py-4 font-normal">Rank</th><th className="px-4 py-4 font-normal">Final equity</th><th className="px-4 py-4 font-normal">Finish</th><th className="w-16 px-4 py-4"><span className="sr-only">Open</span></th></tr></thead><tbody className="divide-y divide-line">{results.slice(0, 4).map((result) => <ResultRow key={result.missionId} result={result} />)}</tbody></table>}</div><p className="mt-4 text-xs text-muted">Past performance is illustrative. Your joined missions and paper orders are saved locally.</p></section>
}

function ResultRow({ result }: { result: ProfileResult }) {
  const returnValue = Number(result.returnPercent)
  const finish = result.rank === 1 ? 'Winner' : result.rank && result.rank <= 3 ? 'Podium' : 'Completed'
  return <tr className="text-sm"><td className="px-6 py-4"><Link to={`/missions/${result.missionId}`} className="focus-ring inline-flex min-h-10 flex-col justify-center rounded-sm font-semibold text-ink hover:text-primary"><span>{result.missionName}</span><span className="mt-1 text-xs font-normal text-muted">{formatResultDate(result.missionDate)}</span></Link></td><td className={`px-4 py-4 font-mono font-semibold ${returnValue >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(returnValue)}</td><td className="px-4 py-4 font-mono text-ink"><span className={result.rank && result.rank <= 3 ? 'text-primary' : ''}>{result.rank ? `#${result.rank}` : '—'}</span><span className="text-muted"> / {result.participantCount}</span></td><td className="px-4 py-4 font-mono font-semibold text-ink">{formatCurrency(result.equity)}</td><td className="px-4 py-4">{finish === 'Completed' ? <span className="text-xs text-muted">{finish}</span> : <span className="rounded border border-primary/25 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary">{finish}</span>}</td><td className="px-4 py-4"><Link to={`/missions/${result.missionId}`} className="focus-ring grid size-10 place-items-center rounded-md text-muted hover:text-primary" aria-label={`Open ${result.missionName}`}><ArrowUpRight className="size-4" aria-hidden="true" /></Link></td></tr>
}

function buildEquitySeries(portfolio: Portfolio, markets: MarketPrice[], orders: OrderHistoryItem[]): EquityPoint[] {
  const timestamps = [...new Set(markets.flatMap((market) => market.history.map((point) => new Date(point.timestamp).getTime())))].filter(Number.isFinite).sort((left, right) => left - right)
  const now = Date.now()
  if (!timestamps.length || timestamps[timestamps.length - 1] < now) timestamps.push(now)
  const filledOrders = orders.filter((order) => order.status === 'FILLED' && order.quantity !== null && order.executionPrice !== null).sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
  const holdings = new Map<string, number>()
  let cash = Number(portfolio.startingBalance)
  let orderIndex = 0
  const points = timestamps.map((timestamp) => {
    while (orderIndex < filledOrders.length && new Date(filledOrders[orderIndex].timestamp).getTime() <= timestamp) {
      const order = filledOrders[orderIndex]
      const quantity = Number(order.quantity)
      const notional = Number(order.notional)
      const fee = Number(order.simulatedFee ?? 0)
      const currentQuantity = holdings.get(order.marketId) ?? 0
      if (order.side === 'BUY') { holdings.set(order.marketId, currentQuantity + quantity); cash -= notional + fee } else { holdings.set(order.marketId, currentQuantity - quantity); cash += notional - fee }
      orderIndex += 1
    }
    const holdingsValue = markets.reduce((total, market) => {
      const quantity = holdings.get(market.marketId) ?? 0
      if (!quantity) return total
      const historical = [...market.history].reverse().find((point) => new Date(point.timestamp).getTime() <= timestamp)
      return total + quantity * Number(historical?.price ?? market.currentPrice)
    }, 0)
    return { timestamp, equity: cash + holdingsValue }
  })
  if (points.length === 1) points.unshift({ timestamp: points[0].timestamp - 1, equity: Number(portfolio.startingBalance) })
  points[points.length - 1] = { timestamp: now, equity: Number(portfolio.totalEquity) }
  return points
}

function buildDemoSeries(endValue: number, startValue = 10000): EquityPoint[] {
  const now = Date.now()
  const pattern = [0, 90, -35, 210, 180, 340, 275, 465, 420, 650, 540, 820, 720, 990, 865, 1150, 1030, 1275, 1160, 1435, 1320, 1620, 1490, 1775, 1690, 1980, 1880, 2150, 2040, 2325, 2250, 2490, 2400, 2650, 2540, 2846.5]
  const scale = (endValue - startValue) / 2846.5
  return pattern.map((offset, index) => ({ timestamp: now - (pattern.length - 1 - index) * 40 * 60 * 1000, equity: startValue + offset * scale }))
}

function startingValueForResult(result: ProfileResult) {
  const multiplier = 1 + Number(result.returnPercent) / 100
  return multiplier > 0 ? Number(result.equity) / multiplier : 10000
}

function filterPointsForRange(points: EquityPoint[], range: PerformanceRange) {
  if (points.length < 3 || range === 'ALL') return points
  const cutoff = points[points.length - 1].timestamp - (range === '24H' ? 24 : 168) * 60 * 60 * 1000
  const filtered = points.filter((point) => point.timestamp >= cutoff)
  return filtered.length >= 2 ? filtered : points
}

function chartGeometry(points: EquityPoint[]) {
  const source = points.length >= 2 ? points : [{ timestamp: 0, equity: 0 }, { timestamp: 1, equity: 0 }]
  const values = source.map((point) => point.equity)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const padding = Math.max((rawMax - rawMin) * 0.1, Math.abs(rawMax) * 0.002, 1)
  const min = rawMin - padding
  const max = rawMax + padding
  const range = Math.max(max - min, 1)
  const firstTimestamp = source[0].timestamp
  const timeRange = Math.max(source[source.length - 1].timestamp - firstTimestamp, 1)
  const coordinates = source.map((point) => ({ x: ((point.timestamp - firstTimestamp) / timeRange) * 560, y: 210 - ((point.equity - min) / range) * 190 }))
  const linePath = smoothChartPath(coordinates)
  return { coordinates, linePath, areaPath: `${linePath} L 560 210 L 0 210 Z`, baselineY: 210 - ((source[0].equity - min) / range) * 190, ticks: Array.from({ length: 4 }, (_, index) => ({ y: 20 + index * (190 / 3), value: max - index * (range / 3) })) }
}

function smoothChartPath(points: { x: number; y: number }[]) {
  if (!points.length) return ''
  return points.slice(1).reduce((path, point, index) => { const previous = points[index]; const controlX = (previous.x + point.x) / 2; return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}` }, `M ${points[0].x} ${points[0].y}`)
}

function formatAxisValue(value: number) { return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}K` : Math.round(value).toString() }
function formatChartTime(timestamp: number) { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(timestamp) }
function formatChartLabel(timestamp?: number) { return timestamp ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(timestamp) : '—' }
function formatResultDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) }

function MissionPanelSkeleton() { return <div className="min-h-[34rem] animate-pulse rounded-xl border border-line bg-surface" aria-busy="true" aria-label="Loading joined missions"><div className="h-16 border-b border-line" /><div className="mx-6 mt-16 h-5 w-40 rounded bg-line" /><div className="mx-6 mt-4 h-10 max-w-sm rounded bg-surface-raised" /></div> }
function EnrollmentError({ message, retry }: { message: string; retry: () => void }) { return <section className="min-h-[34rem] rounded-xl border border-danger/40 bg-danger/5 p-6" role="alert"><h2 className="text-lg font-semibold text-ink">Joined missions unavailable</h2><p className="mt-2 text-sm text-muted">{message}</p><button type="button" onClick={retry} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm text-ink hover:border-primary"><RotateCw className="size-4" aria-hidden="true" />Retry</button></section> }
function DashboardSkeleton() { return <div className="w-full space-y-7" aria-busy="true" aria-label="Loading dashboard"><div className="h-28 animate-pulse border-b border-line bg-surface" /><div className="grid grid-cols-2 gap-px border-b border-line sm:grid-cols-3 xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-28 animate-pulse bg-surface" />)}</div><div className="grid gap-6 lg:grid-cols-2"><div className="h-[34rem] animate-pulse rounded-xl border border-line bg-surface" /><div className="h-[34rem] animate-pulse rounded-xl border border-line bg-surface" /></div></div> }
function DashboardError({ message, retry }: { message: string; retry: () => void }) { return <div className="mx-auto max-w-2xl rounded-xl border border-danger/40 bg-danger/5 p-6" role="alert"><Award className="size-5 text-danger" aria-hidden="true" /><h1 className="mt-4 text-xl font-semibold text-ink">Dashboard unavailable</h1><p className="mt-2 text-sm text-muted">{message}</p><button type="button" onClick={retry} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm text-ink hover:border-primary"><RotateCw className="size-4" aria-hidden="true" />Retry</button></div> }
