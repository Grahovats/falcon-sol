import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { CashEntryInput } from '../types/mission'
import { apiGet } from '../api/client'
import { MissionLifecycle } from '../features/missions/MissionLifecycle'
import { PrizePanel } from '../features/missions/PrizePanel'
import { joinMission } from '../api/trading'
import { MissionBrief } from '../features/trading/MissionBrief'
import { TradingTerminal } from '../features/trading/TradingTerminal'
import { ResultsView } from '../features/trading/ResultsView'
import { useTradingData } from '../features/trading/useTradingData'
import { useMission } from '../hooks/useMission'

export function MissionDetailPage() {
  const { id = '' } = useParams()
  const missionState = useMission(id)
  const trading = useTradingData(id)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)

  const [cashStatus, setCashStatus] = useState('PENDING')
  const cashJoined = missionState.status === 'success' && Boolean(missionState.mission.rewards) && trading.portfolio.status === 'success'
  useEffect(() => {
    if (!cashJoined) return
    const controller = new AbortController()
    const load = async () => { try { const result = await apiGet<{ data: { status: string } | null }>(`/missions/${encodeURIComponent(id)}/rewards/me`, controller.signal); setCashStatus(result.data?.status ?? 'PENDING') } catch { if (!controller.signal.aborted) setCashStatus('UNAVAILABLE') } }
    void load(); const timer = window.setInterval(() => void load(), 10000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [cashJoined, id])

  async function deploy(input?: CashEntryInput) {
    setDeploying(true)
    setDeployError(null)
    try {
      await joinMission(id, input)
      await Promise.all([trading.refreshPortfolio(), trading.refreshLeaderboard()])
    } catch (error: unknown) {
      setDeployError(error instanceof Error ? error.message : 'Deployment failed.')
    } finally {
      setDeploying(false)
    }
  }

  if (missionState.status === 'loading') return <TerminalSkeleton />
  if (missionState.status === 'error') return <ErrorPanel title="Mission unavailable" message={missionState.message} />

  const { mission } = missionState
  if (mission.status === 'SETTLING' || mission.status === 'CANCELLED') return <MissionLifecycle mission={mission} />
  const completed = ['FINALIZED', 'CLOSED'].includes(mission.status)
  if (completed) {
    return <div>{mission.rewards && <PrizePanel mission={mission} />}<ResultsView mission={mission} portfolio={trading.portfolio.status === 'success' ? trading.portfolio.data : undefined} portfolioLoading={trading.portfolio.status === 'loading'} portfolioError={trading.portfolio.status === 'error' ? trading.portfolio.message : undefined} onRetry={() => { void trading.refreshPortfolio(); void trading.refreshLeaderboard() }} rows={trading.leaderboard.status === 'success' ? trading.leaderboard.data.data : []} loading={trading.leaderboard.status === 'loading'} error={trading.leaderboard.status === 'error' ? trading.leaderboard.message : undefined} /></div>
  }
  if (trading.portfolio.status === 'loading') return <TerminalSkeleton />
  if (trading.portfolio.status === 'authentication-required' || trading.portfolio.status === 'not-joined') {
    return <div><BackLink /><MissionBrief mission={mission} deploying={deploying} error={deployError} onDeploy={input => void deploy(input)}
      requiresAuthentication={trading.portfolio.status === 'authentication-required'}
      leaderboard={trading.leaderboard.status === 'success' ? trading.leaderboard.data.data : []}
      leaderboardLoading={trading.leaderboard.status === 'loading'}
      leaderboardError={trading.leaderboard.status === 'error' ? trading.leaderboard.message : undefined}
      leaderboardHidden={trading.leaderboard.status === 'success' && trading.leaderboard.data.meta.hidden}
    /></div>
  }
  if (trading.portfolio.status === 'error') {
    return <ErrorPanel title="Portfolio unavailable" message={trading.portfolio.message} onRetry={() => void trading.refreshPortfolio()} />
  }
  if (trading.markets.status === 'loading') return <TerminalSkeleton />
  if (trading.markets.status === 'error') {
    return <ErrorPanel title="Market feed unavailable" message={trading.markets.message} onRetry={() => void trading.refreshMarkets()} />
  }

  return (
    <>{mission.rewards && <PrizePanel mission={mission} />}
    {mission.rewards && <p className="border-x border-line bg-surface px-4 py-3 text-sm text-muted">Eligibility: {cashStatus.toLowerCase()}{cashStatus !== 'APPROVED' ? ' · Trading stays locked until the organizer approves your identity and location.' : ' · Approved for this mission.'}</p>}
    <TradingTerminal
      cashEligibilityApproved={!mission.rewards || cashStatus === 'APPROVED'}
      mission={mission}
      markets={trading.markets.data}
      portfolio={trading.portfolio.data}
      leaderboard={trading.leaderboard.status === 'success' ? trading.leaderboard.data.data : []}
      leaderboardHidden={trading.leaderboard.status === 'success' && trading.leaderboard.data.meta.hidden}
      leaderboardError={trading.leaderboard.status === 'error' ? trading.leaderboard.message : undefined}
      orders={trading.orders.status === 'success' ? trading.orders.data : []}
      ordersError={trading.orders.status === 'error' ? trading.orders.message : undefined}
      onPortfolioUpdate={trading.updatePortfolio}
      onOrderFilled={async () => {
        await Promise.all([trading.refreshPortfolio(), trading.refreshLeaderboard(), trading.refreshOrders()])
      }}
      onMarketsChanged={async () => { await trading.refreshMarkets() }}
    /></>
  )
}

function BackLink() {
  return <Link to="/missions" className="app-button focus-ring mb-6 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Mission board</Link>
}

function ErrorPanel({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="border border-danger/40 bg-danger/5 p-6" role="alert">
      <h1 className="text-xl font-semibold text-ink">{title}</h1><p className="mt-2 text-muted">{message}</p>
      <div className="mt-5 flex flex-wrap gap-3">{onRetry && <button type="button" onClick={onRetry} className="app-button focus-ring min-h-11 border border-line px-4 text-sm text-ink hover:border-primary">Retry</button>}<Link to="/missions" className="app-button focus-ring inline-flex min-h-11 items-center gap-2 text-primary"><ArrowLeft className="size-4" aria-hidden="true" /> Mission board</Link></div>
    </div>
  )
}

function TerminalSkeleton() {
  return <div className="trading-terminal app-surface" aria-busy="true" aria-label="Loading trading terminal"><section className="app-surface h-24 animate-pulse" /><div className="terminal-grid"><div className="app-surface terminal-watch min-h-40 animate-pulse xl:min-h-96" /><div className="app-surface terminal-chart min-w-0"><div className="h-40 animate-pulse border-b border-line" /><div className="terminal-chart-canvas animate-pulse" /></div><div className="app-surface terminal-order min-h-96 animate-pulse" /></div></div>
}
