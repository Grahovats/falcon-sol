import { ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, Crosshair, RotateCw, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfile, type ProfileResult, type ProfileSummary } from '../api/profile'
import { getLeaderboard, getPortfolio } from '../api/trading'
import { CountUpValue } from '../components/CountUpValue'
import { AuthenticationRequired } from '../components/AuthenticationRequired'
import { useMissions } from '../features/missions/useMissions'
import { useCountdown } from '../hooks/useCountdown'
import { useClock } from '../hooks/useClock'
import { formatCurrency, formatPercent } from '../lib/format'
import { useAuth } from '../providers/auth-context'
import type { Mission } from '../types/mission'
import type { Portfolio } from '../types/trading'
import './DashboardPage.css'

type Resource<T> = { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; message: string }
interface EnrolledMission { mission: Mission; portfolio: Portfolio }
type RecordMode = 'practice' | 'prize'
const openStatuses = new Set(['REGISTRATION', 'LOCKED', 'ACTIVE', 'BLACKOUT'])
const finalStatuses = new Set(['FINALIZED', 'CLOSED'])
const liveStatuses = new Set(['ACTIVE', 'BLACKOUT'])

export function DashboardPage() {
  const auth = useAuth()
  const missions = useMissions()
  const [profile, setProfile] = useState<Resource<ProfileSummary>>({ status: 'loading' })
  const [enrollment, setEnrollment] = useState<Resource<EnrolledMission[]>>({ status: 'loading' })
  const [selectedMissionId, setSelectedMissionId] = useState('')
  const [recordMode, setRecordMode] = useState<RecordMode>('practice')
  const [enrollmentRetry, setEnrollmentRetry] = useState(0)
  const missionState = missions.state

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    setProfile({ status: 'loading' })
    try {
      const { data } = await getProfile(signal)
      if (!signal?.aborted) setProfile({ status: 'success', data })
    } catch (error: unknown) {
      if (signal?.aborted) return
      setProfile({ status: 'error', message: error instanceof Error ? error.message : 'Your dashboard could not be loaded.' })
    }
  }, [])

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const controller = new AbortController()
    const timer = window.setTimeout(() => void loadProfile(controller.signal), 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [auth.status, auth.user?.userId, loadProfile])

  useEffect(() => {
    if (auth.status !== 'authenticated' || missionState.status !== 'success' || profile.status !== 'success') return
    const controller = new AbortController()
    // Profile results contain all entered missions; only fetch portfolios for actual entries.
    const joinedIds = new Set(profile.data.results.map(result => result.missionId))
    const candidates = missionState.missions.filter(mission => joinedIds.has(mission.id) && openStatuses.has(mission.status))
      .sort((a, b) => Number(liveStatuses.has(b.status)) - Number(liveStatuses.has(a.status)) || new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
    void Promise.all(candidates.map(async mission => ({ mission, portfolio: (await getPortfolio(mission.id, controller.signal)).data })))
      .then(data => { if (!controller.signal.aborted) setEnrollment({ status: 'success', data }) })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setEnrollment({ status: 'error', message: error instanceof Error ? error.message : 'Your missions could not be loaded.' })
      })
    return () => controller.abort()
  }, [auth.status, auth.user?.userId, missionState, profile, enrollmentRetry])

  if (auth.status === 'loading' || auth.status === 'signing') return <DashboardSkeleton />
  if (auth.status !== 'authenticated') return <AuthenticationRequired title="Sign in to view your dashboard" />
  if (profile.status === 'loading') return <DashboardSkeleton />
  if (profile.status === 'error') return <div className="dashboard-workspace"><DashboardHeader username={auth.user?.username ?? 'Operator'} /><DashboardNotice title="Dashboard unavailable" message={profile.message} retry={() => void loadProfile()} /></div>

  const allMissions = missionState.status === 'success' ? missionState.missions : []
  const missionById = new Map(allMissions.map(mission => [mission.id, mission]))
  const joinedIds = new Set(profile.data.results.map(result => result.missionId))
  const enrolled = enrollment.status === 'success' ? enrollment.data.filter(entry => entry.portfolio.userId === profile.data.userId) : []
  const selectedEntry = enrolled.find(entry => entry.mission.id === selectedMissionId) ?? enrolled[0]
  const completed = profile.data.results.filter(result => {
    const mission = missionById.get(result.missionId)
    return mission && finalStatuses.has(mission.status) && Boolean(mission.rewards) === (recordMode === 'prize')
  }).sort((a, b) => new Date(b.missionDate).getTime() - new Date(a.missionDate).getTime())
  const available = allMissions.filter(mission => !joinedIds.has(mission.id) && openStatuses.has(mission.status))
    .sort((a, b) => Number(liveStatuses.has(b.status)) - Number(liveStatuses.has(a.status)) || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  const averageReturn = completed.length ? completed.reduce((total, result) => total + Number(result.returnPercent), 0) / completed.length : null
  const ranks = completed.flatMap(result => result.rank === null ? [] : [result.rank])
  const bestFinish = ranks.length ? Math.min(...ranks) : null
  const wins = completed.filter(result => result.rank === 1).length
  const historyReady = missionState.status === 'success'

  return <div className="dashboard-workspace">
    <DashboardHeader username={profile.data.username} />
    <div className="dashboard-record-heading">
      <h2>Your record</h2>
      <div className="dashboard-record-tabs" role="group" aria-label="Performance category">{(['practice', 'prize'] as const).map(mode => <button type="button" key={mode} aria-pressed={recordMode === mode} onClick={() => setRecordMode(mode)} className="focus-ring">{mode === 'practice' ? 'Practice' : 'Prize missions'}</button>)}</div>
    </div>
    <dl className="dashboard-record-strip">
      <RecordMetric key={`${recordMode}-completed`} label="Completed missions" value={historyReady ? completed.length : null} />
      <RecordMetric key={`${recordMode}-return`} label="Average return" value={averageReturn} format="percent" tone={averageReturn === null ? undefined : averageReturn >= 0 ? 'positive' : 'negative'} />
      <RecordMetric key={`${recordMode}-finish`} label="Best finish" value={bestFinish} format="rank" />
      <RecordMetric key={`${recordMode}-wins`} label="Wins" value={historyReady ? wins : null} />
    </dl>
    <div className="dashboard-connected-grid">
      <section className="dashboard-active-section" aria-labelledby="dashboard-active-title">
        <div className="dashboard-section-heading"><h2 id="dashboard-active-title">Your mission</h2>{enrolled.length > 1 && <label className="dashboard-mission-picker"><span className="sr-only">Choose your mission</span><select value={selectedEntry?.mission.id} onChange={event => setSelectedMissionId(event.target.value)} className="focus-ring">{enrolled.map(entry => <option key={entry.mission.id} value={entry.mission.id}>{entry.mission.name}</option>)}</select><ChevronDown className="size-3.5" aria-hidden="true" /></label>}</div>
        {missionState.status === 'error' ? <DashboardNotice title="Missions unavailable" message={missionState.message} retry={missions.retry} />
          : missionState.status === 'loading' || enrollment.status === 'loading' ? <SectionSkeleton label="Loading your mission" />
          : enrollment.status === 'error' ? <DashboardNotice title="Mission unavailable" message={enrollment.message} retry={() => setEnrollmentRetry(value => value + 1)} />
          : selectedEntry ? <ActiveMission entry={selectedEntry} userId={profile.data.userId} />
          : <div className="dashboard-empty-mission"><Crosshair className="size-7 text-primary" strokeWidth={1.5} aria-hidden="true" /><h3>{profile.data.missionsEntered ? 'Ready for your next mission?' : 'Your first mission starts here.'}</h3><p>Choose a mission and put your trading skills to the test.</p><Link to={available[0] ? `/missions/${available[0].id}` : '/missions'} className="dashboard-primary-action focus-ring">{available[0] && !available[0].rewards ? 'Join a practice mission' : 'Explore missions'}<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>}
      </section>
      <section className="dashboard-performance-section" aria-labelledby="dashboard-performance-title">
        <div className="dashboard-section-heading"><h2 id="dashboard-performance-title">Return by mission</h2><span>{completed.length ? `${Math.min(completed.length, 8)} latest` : ''}</span></div>
        <ReturnChart key={recordMode} results={completed.slice(0, 8)} ready={historyReady} />
      </section>
      <section className="dashboard-results-section" aria-labelledby="dashboard-results-title">
        <div className="dashboard-section-heading"><h2 id="dashboard-results-title">Recent results</h2><span>{recordMode === 'practice' ? 'Practice' : 'Prize missions'}</span></div>
        {missionState.status === 'loading' ? <SectionSkeleton label="Loading results" /> : missionState.status === 'error' ? <DashboardNotice title="Results unavailable" message={missionState.message} retry={missions.retry} /> : completed.length ? <div className="dashboard-table-scroll"><table className="dashboard-results-table"><thead><tr><th>Mission</th><th>Finish</th><th>Return</th><th>Final equity</th><th><span className="sr-only">Open result</span></th></tr></thead><tbody>{completed.slice(0, 4).map(result => <tr key={result.missionId}><td><Link to={`/missions/${result.missionId}`} className="focus-ring"><strong>{result.missionName}</strong><span>{formatDate(result.missionDate)}</span></Link></td><td><span className={result.rank === 1 ? 'text-primary' : ''}>{result.rank === null ? '—' : `#${result.rank}`}</span><span className="dashboard-rank-total"> / {result.participantCount}</span></td><td className={Number(result.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}>{formatPercent(result.returnPercent)}</td><td>{formatCurrency(result.equity)}</td><td><Link to={`/missions/${result.missionId}`} className="dashboard-row-link focus-ring" aria-label={`View result for ${result.missionName}`}><ArrowUpRight className="size-4" aria-hidden="true" /></Link></td></tr>)}</tbody></table></div> : <div className="dashboard-results-empty"><Check className="size-5" aria-hidden="true" /><p>Your completed {recordMode === 'practice' ? 'practice' : 'prize'} missions will appear here.</p></div>}
      </section>
      <section className="dashboard-available-section" aria-labelledby="dashboard-available-title">
        <div className="dashboard-section-heading"><h2 id="dashboard-available-title">On the radar</h2><Link to="/missions" className="dashboard-text-link focus-ring">View all<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link></div>
        {missionState.status === 'loading' ? <SectionSkeleton label="Loading available missions" /> : missionState.status === 'error' ? <DashboardNotice title="Mission feed unavailable" message={missionState.message} retry={missions.retry} /> : available.length ? <div>{available.slice(0, 3).map(mission => <AvailableMission key={mission.id} mission={mission} />)}</div> : <div className="dashboard-quiet-empty"><Clock3 className="size-5" aria-hidden="true" /><p>No new missions right now.</p><Link to="/missions" className="dashboard-text-link focus-ring">Visit the mission board<ArrowRight className="size-3.5" aria-hidden="true" /></Link></div>}
      </section>
    </div>
  </div>
}

function DashboardHeader({ username }: { username: string }) {
  return <header className="dashboard-header"><div><p>Welcome back, {username}</p><h1>Dashboard</h1></div><Link to="/missions" className="dashboard-outline-action focus-ring">Explore missions<ArrowUpRight className="size-4" aria-hidden="true" /></Link></header>
}

function RecordMetric({ label, value, format = 'count', tone }: { label: string; value: number | null; format?: 'count' | 'percent' | 'rank'; tone?: 'positive' | 'negative' }) {
  return <div><dt>{label}</dt><dd className={tone === 'positive' ? 'text-primary' : tone === 'negative' ? 'text-danger' : undefined}>{value === null ? '—' : <CountUpValue value={value} format={format} durationMs={900} />}</dd></div>
}

function ActiveMission({ entry, userId }: { entry: EnrolledMission; userId: string }) {
  const { mission, portfolio } = entry
  const live = liveStatuses.has(mission.status)
  const countdown = useCountdown(live ? mission.endsAt : mission.startsAt)
  const now = useClock()
  const startsAt = new Date(mission.startsAt).getTime()
  const duration = new Date(mission.endsAt).getTime() - startsAt
  const progress = duration > 0 ? Math.max(0, Math.min(100, (now - startsAt) / duration * 100)) : 0
  const [standing, setStanding] = useState<{ missionId: string; rank?: number; hidden: boolean }>()
  useEffect(() => {
    const controller = new AbortController()
    const load = () => getLeaderboard(mission.id, controller.signal).then(response => {
      if (!controller.signal.aborted) setStanding({ missionId: mission.id, hidden: response.meta.hidden, rank: response.data.find(row => row.userId === userId)?.rank })
    }).catch(() => { if (!controller.signal.aborted) setStanding({ missionId: mission.id, hidden: false }) })
    void load()
    const timer = window.setInterval(() => void load(), 15_000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [mission.id, userId])
  const rank = standing?.missionId === mission.id ? standing.rank : undefined
  const hidden = mission.status === 'BLACKOUT' || (standing?.missionId === mission.id && standing.hidden)

  return <div className="dashboard-active-mission">
    <div className="dashboard-mission-topline"><span className={`dashboard-mission-state ${live ? 'is-live' : ''}`}><span />{mission.status === 'BLACKOUT' ? 'Blackout' : live ? 'In progress' : 'Registered'}</span><span>{mission.rewards ? 'Prize mission' : 'Practice'}</span></div>
    <div className="dashboard-mission-title-row"><h3>{mission.name}</h3><div className="dashboard-mission-clock"><span>{live ? 'Time remaining' : 'Starts in'}</span><strong>{countdown}</strong></div></div>
    <progress className="dashboard-time-progress" max={100} value={progress} aria-label="Mission time elapsed" />
    <dl className="dashboard-live-metrics"><div><dt>Virtual equity</dt><dd><CountUpValue key={mission.id} value={Number(portfolio.totalEquity)} format="currency" durationMs={900} /></dd></div><div><dt>Return</dt><dd className={Number(portfolio.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}><CountUpValue key={mission.id} value={Number(portfolio.returnPercent)} format="percent" durationMs={900} /></dd></div><div><dt>Current rank</dt><dd>{hidden ? 'Hidden' : rank ? <CountUpValue key={mission.id} value={rank} format="rank" durationMs={900} /> : '—'}{!hidden && rank && <span className="dashboard-live-rank-total"> / {mission.operatorCount}</span>}</dd></div></dl>
    <div className="dashboard-mission-bottom"><dl><div><dt>Buying power</dt><dd><CountUpValue key={mission.id} value={Number(portfolio.cashBalance)} format="currency" durationMs={900} /></dd></div><div><dt>Open positions</dt><dd><CountUpValue key={mission.id} value={portfolio.positions.length} durationMs={900} /></dd></div></dl><Link to={`/missions/${mission.id}`} className="dashboard-primary-action focus-ring">{live ? 'Continue trading' : 'View mission'}<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
  </div>
}

function AvailableMission({ mission }: { mission: Mission }) {
  const live = liveStatuses.has(mission.status)
  const countdown = useCountdown(live ? mission.endsAt : mission.startsAt)
  const joinable = mission.rewards ? mission.status === 'REGISTRATION' && mission.rewards.state === 'READY' && mission.rewards.mode === 'SPONSORED' : ['ACTIVE', 'REGISTRATION'].includes(mission.status)
  return <article className="dashboard-available-mission"><div className="dashboard-available-top"><span className={live ? 'text-primary' : 'text-muted'}>{live ? 'Live now' : mission.status === 'LOCKED' ? 'Locked' : 'Registration'}</span><span>{mission.rewards ? `${formatCurrency(mission.rewards.prizePool)} prizes` : 'Practice'}</span></div><h3><Link to={`/missions/${mission.id}`} className="focus-ring">{mission.name}</Link></h3><div className="dashboard-available-meta"><span>{mission.operatorCount} traders</span><span>{formatCurrency(mission.startingBalance)} capital</span></div><div className="dashboard-available-bottom"><span>{live ? 'Ends in' : 'Starts in'} <strong>{countdown}</strong></span><Link to={`/missions/${mission.id}`} className="dashboard-text-link focus-ring" aria-label={`${joinable ? 'Join' : 'View'} ${mission.name}`}>{joinable ? 'Join' : 'View'}<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link></div></article>
}

function ReturnChart({ results, ready }: { results: ProfileResult[]; ready: boolean }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const points = useMemo(() => [...results].reverse(), [results])
  if (!ready || points.length < 2) return <div className="dashboard-chart-empty"><Trophy className="size-6" strokeWidth={1.5} aria-hidden="true" /><p>{ready ? 'Your track record, over time.' : 'Record unavailable.'}</p><span>{ready ? 'Complete two missions to see your returns.' : 'Returns appear when mission history is available.'}</span></div>

  const values = points.map(point => Number(point.returnPercent))
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const roughStep = (max === min ? 2 : Math.max(max - min, 0.01)) / 3
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const step = ([1, 2, 2.5, 5, 10].find(value => value * magnitude >= roughStep) ?? 10) * magnitude
  const low = min === max ? -step : Math.floor(min / step) * step
  const high = min === max ? step : Math.max(low + step, Math.ceil(max / step) * step)
  const y = (value: number) => 166 - (value - low) / (high - low) * 148
  const coordinates = points.map((point, index) => ({ x: 10 + index / (points.length - 1) * 292, y: y(Number(point.returnPercent)) }))
  // Horizontal tangents preserve each recorded return without overshooting between missions.
  const path = coordinates.slice(1).reduce((line, point, index) => {
    const previous = coordinates[index]
    const middle = (previous.x + point.x) / 2
    return `${line} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`
  }, `M ${coordinates[0].x} ${coordinates[0].y}`)
  const area = `${path} L 302 ${y(0)} L 10 ${y(0)} Z`
  const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, index) => high - index * step)
  const axisFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: Math.min(6, Math.max(0, 1 - Math.floor(Math.log10(step)))) })
  const selected = Math.min(activeIndex ?? points.length - 1, points.length - 1)
  const current = points[selected]
  const marker = coordinates[selected]
  const positive = Number(points.at(-1)!.returnPercent) >= 0

  return <div className={`dashboard-return-chart ${positive ? 'is-positive' : 'is-negative'}`}>
    <div className="dashboard-chart-readout">
      <div><span className="dashboard-chart-value-label">{activeIndex === null ? 'Latest return' : 'Mission return'}</span><strong className={Number(current.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}><CountUpValue value={Number(current.returnPercent)} format="percent" durationMs={900} /></strong></div>
      <div className="dashboard-chart-mission"><span>{current.missionName}</span><span>{formatDate(current.missionDate)}</span></div>
    </div>
    <div className="dashboard-chart-plot focus-ring" role="img" tabIndex={0} aria-label={`${current.missionName}: ${formatPercent(current.returnPercent)}. Use arrow keys to explore completed missions.`}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        setActiveIndex(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, selected + (event.key === 'ArrowLeft' ? -1 : 1))))
      }}
      onPointerMove={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        const chartX = (event.clientX - rect.left) / rect.width * 360
        setActiveIndex(Math.round(Math.max(0, Math.min(1, (chartX - 10) / 292)) * (points.length - 1)))
      }}
      onPointerLeave={() => setActiveIndex(null)}>
      <svg viewBox="0 0 360 184" aria-hidden="true">
        {ticks.map(tick => <g key={tick}><line x1="10" x2="302" y1={y(tick)} y2={y(tick)} className={Math.abs(tick) < step / 100 ? 'dashboard-chart-baseline' : 'dashboard-chart-grid'} /><text x="320" y={y(tick)} dy="0.35em" className="dashboard-chart-axis">{axisFormat.format(tick)}%</text></g>)}
        <path d={area} className="dashboard-chart-area" />
        <path key={points.map(point => point.missionId).join(':')} d={path} className="dashboard-chart-line" />
        <line x1={marker.x} x2={marker.x} y1="14" y2="170" className="dashboard-chart-cursor" />
        {coordinates.map((point, index) => <circle key={points[index].missionId} cx={point.x} cy={point.y} r={2.25} className="dashboard-chart-point" />)}
        <circle cx={marker.x} cy={marker.y} r={8} className="dashboard-chart-halo" />
        <circle cx={marker.x} cy={marker.y} r={3.5} className="dashboard-chart-selected" />
      </svg>
    </div>
    <div className="dashboard-chart-dates"><span>{formatDate(points[0].missionDate)}</span><span>{formatDate(points.at(-1)!.missionDate)}</span></div>
  </div>
}

function DashboardNotice({ title, message, retry }: { title: string; message: string; retry: () => void }) {
  return <div className="dashboard-notice" role="alert"><h3>{title}</h3><p>{message}</p><button type="button" onClick={retry} className="dashboard-text-link focus-ring"><RotateCw className="size-3.5" aria-hidden="true" />Try again</button></div>
}
function SectionSkeleton({ label }: { label: string }) { return <div className="dashboard-section-skeleton motion-safe:animate-pulse" aria-busy="true" aria-label={label}><span /><span /><span /></div> }
function DashboardSkeleton() { return <div className="dashboard-workspace" aria-busy="true" aria-label="Loading dashboard"><header className="dashboard-header"><div className="dashboard-section-skeleton motion-safe:animate-pulse"><span /><span /></div></header><div className="dashboard-record-strip">{[0, 1, 2, 3].map(item => <SectionSkeleton key={item} label="Loading record" />)}</div><div className="dashboard-connected-grid">{[0, 1, 2, 3].map(item => <section key={item}><SectionSkeleton label="Loading dashboard section" /></section>)}</div></div> }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value)) }
