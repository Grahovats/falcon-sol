import { ArrowLeft, Clock3, ShieldX } from 'lucide-react'
import { AuthenticationRequired } from '../components/AuthenticationRequired'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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

  async function deploy() {
    setDeploying(true)
    setDeployError(null)
    try {
      await joinMission(id)
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
  if (mission.status === 'SETTLING') return <LifecyclePanel icon={<Clock3 />} title="Locking final results" description="Falcon is capturing one final price per market and calculating immutable standings. This page updates automatically." />
  if (mission.status === 'CANCELLED') return <LifecyclePanel icon={<ShieldX />} title="Operation stood down" description="Trading is closed and no final ranking will be awarded for this mission." />
  const completed = ['FINALIZED', 'CLOSED'].includes(mission.status)
  if (completed) {
    return <ResultsView mission={mission} portfolio={trading.portfolio.status === 'success' ? trading.portfolio.data : undefined} rows={trading.leaderboard.status === 'success' ? trading.leaderboard.data.data : []} loading={trading.leaderboard.status === 'loading'} error={trading.leaderboard.status === 'error' ? trading.leaderboard.message : undefined} />
  }
  if (trading.portfolio.status === 'loading') return <TerminalSkeleton />
  if (trading.portfolio.status === 'authentication-required') return <div><BackLink /><AuthenticationRequired title="Authenticate before deployment" /></div>
  if (trading.portfolio.status === 'not-joined') {
    return <div><BackLink /><MissionBrief mission={mission} deploying={deploying} error={deployError} onDeploy={() => void deploy()} /></div>
  }
  if (trading.portfolio.status === 'error') {
    return <ErrorPanel title="Portfolio unavailable" message={trading.portfolio.message} onRetry={() => void trading.refreshPortfolio()} />
  }
  if (trading.markets.status === 'loading') return <TerminalSkeleton />
  if (trading.markets.status === 'error') {
    return <ErrorPanel title="Market feed unavailable" message={trading.markets.message} onRetry={() => void trading.refreshMarkets()} />
  }

  return (
    <TradingTerminal
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
    />
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

function LifecyclePanel({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div><BackLink /><section className="app-surface panel-cut border border-line bg-surface p-6 sm:p-10"><div className="flex size-11 items-center justify-center border border-primary/30 bg-primary/5 text-primary [&>svg]:size-5">{icon}</div><h1 className="mt-6 text-3xl font-semibold text-ink">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{description}</p></section></div>
}
