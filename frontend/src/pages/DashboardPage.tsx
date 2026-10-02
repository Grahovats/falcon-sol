import { Activity, ArrowRight, Award, ChevronLeft, ChevronRight, Crosshair, RotateCw, Target, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfile, type ProfileSummary } from '../api/profile'
import { ApiError } from '../api/client'
import { getMarkets, getOrders, getPortfolio } from '../api/trading'
import { AuthenticationRequired } from '../components/AuthenticationRequired'
import { useMissions } from '../features/missions/useMissions'
import { useCountdown } from '../hooks/useCountdown'
import { formatCurrency, formatPercent } from '../lib/format'
import { useAuth } from '../providers/auth-context'
import type { Mission } from '../types/mission'
import type { MarketPrice, OrderHistoryItem, Portfolio } from '../types/trading'

type ProfileState =
  | { status: 'loading' }
  | { status: 'success'; data: ProfileSummary }
  | { status: 'error'; message: string }

interface EnrolledMission { mission: Mission; portfolio: Portfolio }
type EnrollmentState = { status: 'loading' } | { status: 'success'; data: EnrolledMission[] } | { status: 'error'; message: string }

export function DashboardPage() {
  const auth = useAuth()
  const missions = useMissions()
  const [profile, setProfile] = useState<ProfileState>({ status: 'loading' })
  const [enrollment, setEnrollment] = useState<EnrollmentState>({ status: 'loading' })
  const [selectedMissionIndex, setSelectedMissionIndex] = useState(0)

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
        setSelectedMissionIndex(0)
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
  const currentMission = enrolledMissions[selectedMissionIndex]

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">Dashboard</h1>
        </div>
        <p className="font-mono text-xs text-muted">Operator / {profile.data.username}</p>
      </header>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryMetric label="Missions" value={String(profile.data.missionsEntered)} note={`${enrolledMissions.length} current`} />
        <SummaryMetric label="Wins" value={String(profile.data.wins)} note={`${profile.data.topThreeFinishes} top-three finishes`} accent />
        <SummaryMetric label="Podiums" value={String(profile.data.topThreeFinishes)} note="Top-three finishes" accent />
        <SummaryMetric label="Average return" value={formatPercent(profile.data.averageReturn)} note="Across settled missions" positive={Number(profile.data.averageReturn) >= 0} />
        <SummaryMetric label="Best result" value={profile.data.bestResult ? formatPercent(profile.data.bestResult.returnPercent) : '—'} note={profile.data.bestResult?.missionName ?? 'No settled result'} positive={Boolean(profile.data.bestResult && Number(profile.data.bestResult.returnPercent) >= 0)} />
        <SummaryMetric label="Win rate" value={profile.data.missionsEntered ? `${Math.round((profile.data.wins / profile.data.missionsEntered) * 100)}%` : '—'} note={`${profile.data.wins} of ${profile.data.missionsEntered}`} />
      </dl>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
        {enrollment.status === 'loading' ? <div className="h-80 animate-pulse rounded-xl border border-line bg-surface" aria-label="Loading joined missions" /> : enrollment.status === 'error' ? <EnrollmentError message={enrollment.message} retry={missions.retry} /> : currentMission ? <CurrentMission entry={currentMission} index={selectedMissionIndex} total={enrolledMissions.length} onPrevious={() => setSelectedMissionIndex((index) => (index - 1 + enrolledMissions.length) % enrolledMissions.length)} onNext={() => setSelectedMissionIndex((index) => (index + 1) % enrolledMissions.length)} /> : <NoActiveMission />}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><PortfolioPerformancePanel entry={currentMission} /><EnrolledPanel entries={enrolledMissions} selectedIndex={selectedMissionIndex} onSelect={setSelectedMissionIndex} /></div>
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-line bg-surface" aria-labelledby="recent-results-title">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id="recent-results-title" className="text-sm font-semibold text-ink">Recent mission results</h2>
          <Link to="/profile" className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-xs font-medium text-primary">View profile <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
        </div>
        {profile.data.results.length === 0 ? (
          <div className="px-5 py-10 text-center"><p className="text-sm text-muted">No settled results yet.</p><Link to="/missions" className="focus-ring mt-3 inline-flex min-h-10 items-center text-sm text-primary">Browse missions</Link></div>
        ) : (
          <div className="divide-y divide-line">
            {profile.data.results.slice(0, 4).map((result) => (
              <div key={result.missionId} className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_7rem_7rem_9rem] sm:items-center">
                <Link to={`/missions/${result.missionId}`} className="focus-ring min-h-10 content-center font-medium text-ink hover:text-primary">{result.missionName}</Link>
                <span className="font-mono text-muted">{result.rank ? `#${result.rank}` : '—'}</span>
                <span className={`font-mono ${Number(result.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(result.returnPercent)}</span>
                <span className="font-mono text-ink sm:text-right">{formatCurrency(result.equity)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryMetric({ label, value, note, accent = false, positive = false }: { label: string; value: string; note: string; accent?: boolean; positive?: boolean }) {
  return <div className="accent-panel lime-shine rounded-lg border border-line px-4 py-4"><dt className="text-xs text-muted">{label}</dt><dd className={`mt-1.5 font-mono text-lg font-semibold tabular-nums ${accent || positive ? 'text-primary' : 'text-ink'}`}>{value}</dd><p className="mt-1 truncate text-[11px] text-muted">{note}</p></div>
}

function CurrentMission({ entry, index, total, onPrevious, onNext }: { entry: EnrolledMission; index: number; total: number; onPrevious: () => void; onNext: () => void }) {
  const { mission, portfolio } = entry
  const live = mission.status === 'ACTIVE' || mission.status === 'BLACKOUT'
  const countdown = useCountdown(live ? mission.endsAt : mission.startsAt)
  const deployedPercent = Math.max(0, Math.min(100, 100 - (Number(portfolio.cashBalance) / Math.max(Number(portfolio.totalEquity), 1)) * 100))
  return (
    <section className="lime-shine overflow-hidden rounded-xl border border-primary/35 bg-surface" aria-labelledby="current-mission-title" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5">
        <div className="flex flex-wrap items-center gap-3"><span className="size-2 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" aria-hidden="true" /><h2 id="current-mission-title" className="text-xl font-semibold text-ink">{mission.name}</h2><span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">{live ? 'Active' : 'Enrolled'}</span></div>
        <div className="flex items-center gap-3"><div className="text-right"><p className="font-mono text-[10px] uppercase tracking-wider text-muted">{live ? 'Time left' : 'Starts in'}</p><p className="mt-1 font-mono text-sm tabular-nums text-ink">{countdown}</p></div>{total > 1 && <div className="flex gap-2"><button type="button" onClick={onPrevious} className="focus-ring grid size-10 place-items-center rounded-md border border-line bg-surface-raised text-muted hover:border-primary hover:text-primary" aria-label="Previous joined mission"><ChevronLeft className="size-4" aria-hidden="true" /></button><button type="button" onClick={onNext} className="focus-ring grid size-10 place-items-center rounded-md border border-line bg-surface-raised text-muted hover:border-primary hover:text-primary" aria-label="Next joined mission"><ChevronRight className="size-4" aria-hidden="true" /></button></div>}</div>
      </div>
      <div className="border-b border-line bg-primary/5 px-5 py-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <div className="shrink-0"><p className={`font-mono text-4xl font-semibold tracking-[-0.06em] ${Number(portfolio.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}`}>{formatPercent(portfolio.returnPercent)}</p><p className="mt-1 text-xs text-muted">Your return</p></div>
          <div className="min-w-0 flex-1"><div className="flex items-center justify-between text-xs"><span className="text-muted">Capital deployed</span><span className="font-mono text-primary">{Math.round(deployedPercent)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary" style={{ width: `${deployedPercent}%` }} /></div><div className="mt-2 flex justify-between font-mono text-[10px] text-muted"><span>{portfolio.positions.length} open positions</span><span>{index + 1} / {total}</span></div></div>
          <span className={`rounded-md border px-3 py-2 text-xs font-semibold ${live ? 'border-warning/40 bg-warning/10 text-warning' : 'border-primary/30 bg-primary/10 text-primary'}`}>{live ? 'In progress' : 'Enrolled'}</span>
        </div>
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-3">
        <MissionMetric icon={<Crosshair />} label="Equity" value={formatCurrency(portfolio.totalEquity)} />
        <MissionMetric icon={<Activity />} label="Cash available" value={formatCurrency(portfolio.cashBalance)} />
        <MissionMetric icon={<Target />} label="Open positions" value={String(portfolio.positions.length)} />
      </div>
      <div className="px-5 py-5"><p className="max-w-2xl text-sm leading-6 text-muted">{mission.description ?? 'Mission parameters are live. Review the market roster before opening the terminal.'}</p><div className="mt-5 flex flex-wrap gap-3"><Link to={`/missions/${mission.id}`} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-ink">Open mission <ArrowRight className="size-4" aria-hidden="true" /></Link><Link to="/rankings" className="focus-ring inline-flex min-h-11 items-center rounded-md border border-line px-5 text-sm font-medium text-ink hover:border-primary">Command board</Link></div></div>
    </section>
  )
}

function MissionMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="bg-surface/90 px-5 py-4"><p className="flex items-center gap-2 text-xs text-muted [&>svg]:size-3.5 [&>svg]:text-primary">{icon}{label}</p><p className="mt-2 font-mono text-sm text-ink">{value}</p></div>
}

interface EquityPoint { timestamp: number; equity: number }
type PerformanceState = { status: 'loading' } | { status: 'success'; points: EquityPoint[] } | { status: 'error'; message: string }

function PortfolioPerformancePanel({ entry }: { entry?: EnrolledMission }) {
  const [state, setState] = useState<PerformanceState>({ status: 'loading' })
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    if (!entry) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setState({ status: 'loading' })
      Promise.all([getMarkets(entry.mission.id, controller.signal), getOrders(entry.mission.id, controller.signal)])
        .then(([markets, orders]) => setState({ status: 'success', points: buildEquitySeries(entry.portfolio, markets.data, orders.data) }))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setState({ status: 'error', message: error instanceof Error ? error.message : 'Portfolio performance could not be loaded.' })
        })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [entry, requestKey])

  const geometry = useMemo(() => chartGeometry(state.status === 'success' ? state.points : []), [state])

  if (!entry) return <aside className="grid min-h-48 place-items-center rounded-xl border border-line bg-surface p-5 text-center"><div><h2 className="text-sm font-semibold text-ink">Portfolio performance</h2><p className="mt-3 text-xs text-muted">Join a mission to start an equity curve.</p></div></aside>
  if (state.status === 'loading') return <aside className="min-h-48 rounded-xl border border-line bg-surface p-5" aria-busy="true" aria-label="Loading portfolio performance"><div className="h-3 w-32 animate-pulse rounded bg-line" /><div className="mt-6 h-24 animate-pulse rounded bg-surface-raised" /></aside>
  if (state.status === 'error') return <aside className="min-h-48 rounded-xl border border-danger/40 bg-danger/5 p-5" role="alert"><h2 className="text-sm font-semibold text-danger">Portfolio performance</h2><p className="mt-3 text-xs leading-5 text-muted">{state.message}</p><button type="button" onClick={() => setRequestKey((key) => key + 1)} className="focus-ring mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-3 text-xs text-ink hover:border-primary"><RotateCw className="size-3.5" aria-hidden="true" />Retry</button></aside>

  const change = Number(entry.portfolio.totalEquity) - Number(entry.portfolio.startingBalance)
  const positive = change >= 0
  return (
    <aside className="rounded-xl border border-line bg-surface p-5" aria-labelledby="performance-title">
      <div className="flex items-start justify-between gap-3"><div><h2 id="performance-title" className="text-sm font-semibold text-ink">Portfolio performance</h2><p className="mt-2 font-mono text-lg font-semibold text-ink">{formatCurrency(entry.portfolio.totalEquity)}</p></div><span className={`font-mono text-xs font-semibold ${positive ? 'text-primary' : 'text-danger'}`}>{formatPercent(entry.portfolio.returnPercent)}</span></div>
      <InteractiveEquityChart points={state.points} geometry={geometry} positive={positive} label={entry.mission.name} />
      <div className="mt-3 flex items-end justify-between"><div><p className="text-[10px] text-muted">Start</p><p className="mt-1 font-mono text-xs text-ink">{formatCurrency(entry.portfolio.startingBalance)}</p></div><div className="text-right"><p className="text-[10px] text-muted">P&amp;L</p><p className={`mt-1 font-mono text-xs ${positive ? 'text-primary' : 'text-danger'}`}>{formatCurrency(change)}</p></div></div>
    </aside>
  )
}

function InteractiveEquityChart({ points, geometry, positive, label }: { points: EquityPoint[]; geometry: ReturnType<typeof chartGeometry>; positive: boolean; label: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const resolvedIndex = activeIndex ?? points.length - 1
  const activePoint = points[resolvedIndex]
  const activeCoordinate = geometry.coordinates[resolvedIndex]

  function selectFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const chartX = Math.max(0, Math.min(400, ((event.clientX - bounds.left) / bounds.width) * 400))
    const nearestIndex = geometry.coordinates.reduce((bestIndex, point, index) => Math.abs(point.x - chartX) < Math.abs(geometry.coordinates[bestIndex].x - chartX) ? index : bestIndex, 0)
    setActiveIndex(nearestIndex)
  }

  function handleKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    setActiveIndex((current) => Math.max(0, Math.min(points.length - 1, (current ?? points.length - 1) + direction)))
  }

  const tooltipAlignment = activeCoordinate.x < 70 ? 'translate-x-0' : activeCoordinate.x > 330 ? '-translate-x-full' : '-translate-x-1/2'
  return (
    <div
      className={`focus-ring relative mt-4 h-36 touch-none overflow-hidden rounded-md border border-line bg-surface-muted ${positive ? 'text-primary' : 'text-danger'}`}
      role="img"
      tabIndex={0}
      aria-label={`${label} portfolio equity chart. Use left and right arrow keys to inspect values.`}
      onPointerMove={selectFromPointer}
      onPointerDown={selectFromPointer}
      onPointerLeave={() => setActiveIndex(null)}
      onFocus={() => setActiveIndex((current) => current ?? points.length - 1)}
      onBlur={() => setActiveIndex(null)}
      onKeyDown={handleKeyboard}
    >
      <svg viewBox="0 0 400 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        {[20, 40, 60, 80].map((value) => <line key={`h-${value}`} x1="0" y1={value} x2="400" y2={value} stroke="currentColor" strokeOpacity="0.06" vectorEffect="non-scaling-stroke" />)}
        {[80, 160, 240, 320].map((value) => <line key={`v-${value}`} x1={value} y1="0" x2={value} y2="100" stroke="currentColor" strokeOpacity="0.06" vectorEffect="non-scaling-stroke" />)}
        <line x1="0" y1={geometry.baselineY} x2="400" y2={geometry.baselineY} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        <path d={geometry.areaPath} fill="currentColor" fillOpacity="0.12" />
        <path d={geometry.linePath} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {activeIndex !== null && <><line x1={activeCoordinate.x} y1="0" x2={activeCoordinate.x} y2="100" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" /><circle cx={activeCoordinate.x} cy={activeCoordinate.y} r="4" fill="var(--color-surface-muted)" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></>}
      </svg>
      {activeIndex !== null && <div className={`pointer-events-none absolute top-2 z-10 rounded-md border border-primary/30 bg-surface px-2.5 py-2 shadow-lg shadow-black/20 ${tooltipAlignment}`} style={{ left: `${(activeCoordinate.x / 400) * 100}%` }}><p className="font-mono text-xs font-semibold tabular-nums text-ink">{formatCurrency(activePoint.equity)}</p><p className="mt-1 whitespace-nowrap font-mono text-[9px] text-muted">{formatChartTime(activePoint.timestamp)}</p></div>}
      <span className="sr-only" aria-live="polite">{activeIndex !== null ? `${formatCurrency(activePoint.equity)} at ${formatChartTime(activePoint.timestamp)}` : ''}</span>
    </div>
  )
}

function buildEquitySeries(portfolio: Portfolio, markets: MarketPrice[], orders: OrderHistoryItem[]): EquityPoint[] {
  const timestamps = [...new Set(markets.flatMap((market) => market.history.map((point) => new Date(point.timestamp).getTime())))].filter(Number.isFinite).sort((left, right) => left - right)
  const now = Date.now()
  if (timestamps.length === 0 || timestamps[timestamps.length - 1] < now) timestamps.push(now)

  const filledOrders = orders
    .filter((order) => order.status === 'FILLED' && order.quantity !== null && order.executionPrice !== null)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
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
      if (order.side === 'BUY') {
        holdings.set(order.marketId, currentQuantity + quantity)
        cash -= notional + fee
      } else {
        holdings.set(order.marketId, currentQuantity - quantity)
        cash += notional - fee
      }
      orderIndex += 1
    }

    const holdingsValue = markets.reduce((total, market) => {
      const quantity = holdings.get(market.marketId) ?? 0
      if (quantity === 0) return total
      const historical = [...market.history].reverse().find((point) => new Date(point.timestamp).getTime() <= timestamp)
      return total + quantity * Number(historical?.price ?? market.currentPrice)
    }, 0)
    return { timestamp, equity: cash + holdingsValue }
  })

  if (points.length === 1) points.unshift({ timestamp: points[0].timestamp - 1, equity: Number(portfolio.startingBalance) })
  points[points.length - 1] = { timestamp: now, equity: Number(portfolio.totalEquity) }
  return points
}

function chartGeometry(points: EquityPoint[]) {
  const source = points.length >= 2 ? points : [{ timestamp: 0, equity: 0 }, { timestamp: 1, equity: 0 }]
  const values = source.map((point) => point.equity)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, Math.abs(max) * 0.002, 1)
  const firstTimestamp = source[0].timestamp
  const timeRange = Math.max(source[source.length - 1].timestamp - firstTimestamp, 1)
  const coordinates = source.map((point) => ({ x: ((point.timestamp - firstTimestamp) / timeRange) * 400, y: 88 - ((point.equity - min) / range) * 72 }))
  const linePath = smoothChartPath(coordinates)
  const startEquity = source[0].equity
  const baselineY = 88 - ((startEquity - min) / range) * 72
  return { coordinates, linePath, areaPath: `${linePath} L 400 96 L 0 96 Z`, baselineY }
}

function smoothChartPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return ''
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const controlX = (previous.x + point.x) / 2
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`
  }, `M ${points[0].x} ${points[0].y}`)
}

function formatChartTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(timestamp)
}

function EnrolledPanel({ entries, selectedIndex, onSelect }: { entries: EnrolledMission[]; selectedIndex: number; onSelect: (index: number) => void }) {
  return <aside className="rounded-xl border border-line bg-surface p-5"><h2 className="text-sm font-semibold text-ink">Joined missions</h2>{entries.length === 0 ? <div className="py-5 text-center"><p className="text-xs text-muted">You have no current mission.</p><Link to="/missions" className="focus-ring mt-2 inline-flex min-h-10 items-center text-xs font-medium text-primary">Browse missions →</Link></div> : <div className="mt-3 space-y-1">{entries.map((entry, index) => <button key={entry.mission.id} type="button" onClick={() => onSelect(index)} aria-pressed={selectedIndex === index} className={`focus-ring flex min-h-10 w-full items-center justify-between rounded-md px-2 text-left text-xs ${selectedIndex === index ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-primary/5'}`}><span className="truncate">{entry.mission.name}</span><span className="font-mono">{formatPercent(entry.portfolio.returnPercent)}</span></button>)}</div>}</aside>
}

function NoActiveMission() {
  return <section className="grid min-h-72 place-items-center rounded-xl border border-line bg-surface p-8 text-center"><div><Trophy className="mx-auto size-7 text-primary" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold text-ink">No current mission</h2><p className="mt-2 text-sm text-muted">Join a mission to track it here.</p><Link to="/missions" className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-ink">Browse missions <ArrowRight className="size-4" aria-hidden="true" /></Link></div></section>
}

function EnrollmentError({ message, retry }: { message: string; retry: () => void }) {
  return <section className="rounded-xl border border-danger/40 bg-danger/5 p-6" role="alert"><h2 className="text-lg font-semibold text-ink">Joined missions unavailable</h2><p className="mt-2 text-sm text-muted">{message}</p><button type="button" onClick={retry} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm text-ink hover:border-primary"><RotateCw className="size-4" aria-hidden="true" />Retry</button></section>
}

function DashboardSkeleton() {
  return <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard"><div className="h-20 animate-pulse border-b border-line bg-surface" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg bg-surface" />)}</div><div className="h-80 animate-pulse rounded-xl border border-line bg-surface" /></div>
}

function DashboardError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="rounded-xl border border-danger/40 bg-danger/5 p-6" role="alert"><Award className="size-5 text-danger" aria-hidden="true" /><h1 className="mt-4 text-xl font-semibold text-ink">Dashboard unavailable</h1><p className="mt-2 text-sm text-muted">{message}</p><button type="button" onClick={retry} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm text-ink hover:border-primary"><RotateCw className="size-4" aria-hidden="true" />Retry</button></div>
}
