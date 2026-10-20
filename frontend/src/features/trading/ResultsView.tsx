import { ArrowLeft, ArrowUpRight, Check, Flag, Medal, RotateCw, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SolanaAccountIcon } from '../../components/SolanaAccountIcon'
import { formatCurrency, formatDate, formatPercent } from '../../lib/format'
import type { Mission } from '../../types/mission'
import type { LeaderboardRow, Portfolio } from '../../types/trading'
import './ResultsView.css'

interface ResultsViewProps {
  mission: Mission
  portfolio?: Portfolio
  portfolioLoading?: boolean
  portfolioError?: string
  rows: LeaderboardRow[]
  loading: boolean
  error?: string
  onRetry: () => void
}

export function ResultsView({ mission, portfolio, portfolioLoading, portfolioError, rows, loading, error, onRetry }: ResultsViewProps) {
  const personal = portfolio ? rows.find((row) => row.userId === portfolio.userId) : undefined
  const bestPosition = portfolio?.positions.reduce((best, position) => !best || Number(position.unrealizedPnl) > Number(best.unrealizedPnl) ? position : best, undefined as Portfolio['positions'][number] | undefined)
  const positive = portfolio ? Number(portfolio.returnPercent) >= 0 : true
  const rankPending = Boolean(portfolio && loading)
  const rankLabel = personal ? (personal.rank === 1 ? 'Mission winner' : personal.rank <= 3 ? 'Podium finish' : 'Mission complete') : 'Mission complete'
  const cash = Math.max(0, Number(portfolio?.cashBalance ?? 0))
  const holdings = Math.max(0, Number(portfolio?.totalEquity ?? 0) - cash)
  const cashPercent = cash + holdings > 0 ? cash / (cash + holdings) * 100 : 0

  return (
    <div className="mission-results">
      <nav className="results-navigation" aria-label="Mission navigation">
        <Link to="/missions" className="focus-ring"><ArrowLeft className="size-4" aria-hidden="true" />Mission board</Link>
        <span><Check className="size-3.5" aria-hidden="true" />Trading complete</span>
      </nav>

      <section className="results-sheet" aria-labelledby="results-title">
        <div className="results-sheet-main">
          <h1 id="results-title">{mission.name}</h1>
          <p className="results-ended">Closed {formatDate(mission.endsAt)} <span aria-hidden="true">/</span> {mission.operatorCount} operators</p>
          {portfolioLoading ? <div className="results-loading motion-safe:animate-pulse" aria-busy="true" aria-label="Loading your results"><span /><span /></div> : portfolio ? (
            <div className="results-performance">
              <div className="results-return"><span>Your return</span><strong className={positive ? 'text-primary' : 'text-danger'}>{formatPercent(portfolio.returnPercent)}</strong></div>
              <dl className="results-equity">
                <div><dt>Final equity</dt><dd>{formatCurrency(portfolio.totalEquity)}</dd></div>
                <div><dt>Net P&amp;L</dt><dd className={Number(portfolio.totalPnl) >= 0 ? 'text-primary' : 'text-danger'}>{formatCurrency(portfolio.totalPnl)}</dd></div>
              </dl>
            </div>
          ) : portfolioError ? <ResultsError message={portfolioError} onRetry={onRetry} /> : <div className="results-observer"><Flag className="size-6" aria-hidden="true" /><p>You watched this one from the sidelines.<span>Explore the final standings, then find your next mission.</span></p></div>}
        </div>
        <aside className="results-rank-panel" aria-label="Mission finish">
          <div className="results-rank-seal">
            <div className="results-seal-inner">
              <Trophy className="size-6" strokeWidth={1.5} aria-hidden="true" />
              <span className="results-rank-label">{portfolio ? 'Final rank' : 'Operation'}</span>
              <strong>{personal ? <><span>#</span>{personal.rank}</> : rankPending || portfolioLoading ? '…' : portfolio ? '—' : <Check className="size-16" strokeWidth={1} aria-hidden="true" />}</strong>
              <span className="results-rank-total">{personal ? `of ${mission.operatorCount} operators` : rankPending || portfolioLoading ? 'Loading results' : portfolio ? error ? 'Standings unavailable' : 'Unranked' : 'Complete'}</span>
            </div>
          </div>
          <p>{rankLabel}</p>
        </aside>
      </section>

      {portfolio && <div className="results-analysis">
        <section className="results-breakdown" aria-labelledby="results-capital-title">
          <div className="results-section-heading"><h2 id="results-capital-title">Where you finished</h2><span>Portfolio breakdown</span></div>
          <dl className="results-capital-totals"><div><dt>Starting capital</dt><dd>{formatCurrency(portfolio.startingBalance)}</dd></div><ArrowUpRight className="size-5" aria-hidden="true" /><div><dt>Final equity</dt><dd>{formatCurrency(portfolio.totalEquity)}</dd></div></dl>
          <div className="results-allocation" aria-hidden="true"><span style={{ width: `${cashPercent}%` }} /></div>
          <dl className="results-allocation-legend"><div><dt><i />Cash</dt><dd>{formatCurrency(cash)}</dd></div><div><dt><i />Open positions</dt><dd>{formatCurrency(holdings)}</dd></div></dl>
        </section>
        <section className="results-position" aria-labelledby="results-position-title">
          <div className="results-section-heading"><h2 id="results-position-title">Position spotlight</h2><Medal className="size-5" aria-hidden="true" /></div>
          {bestPosition ? <><p className="results-position-symbol">{bestPosition.symbol}</p><div className="results-position-pnl"><strong className={Number(bestPosition.unrealizedPnl) >= 0 ? 'text-primary' : 'text-danger'}>{formatCurrency(bestPosition.unrealizedPnl)}</strong><span>Unrealized P&amp;L at close</span></div><p className="results-position-note">Highest unrealized P&amp;L among your open positions.</p></> : <><p className="results-position-symbol">All in cash.</p><p className="results-position-note">You finished with no open positions. Your result is reflected in the final equity above.</p></>}
        </section>
      </div>}

      <section className="results-standings" aria-labelledby="results-standings-title">
        <div className="results-section-heading"><div><p className="results-label">The final order</p><h2 id="results-standings-title">Mission standings</h2></div><span>{mission.operatorCount} operators</span></div>
        {loading ? <div className="results-standings-skeleton motion-safe:animate-pulse" aria-busy="true" aria-label="Loading final standings">{[0, 1, 2].map(item => <span key={item} />)}</div> : error ? <ResultsError message={error} onRetry={onRetry} /> : rows.length === 0 ? <p className="results-empty">No ranked operators for this mission.</p> : <div className="results-table-scroll"><table className="results-table"><thead><tr><th>Place</th><th>Operator</th><th>Final equity</th><th>Net P&amp;L</th><th>Return</th><th><span className="sr-only">Operator profile</span></th></tr></thead><tbody>{rows.map(row => <tr key={row.userId} className={row.userId === portfolio?.userId ? 'is-you' : ''}><td><span className={`results-place ${row.rank <= 3 ? 'is-podium' : ''}`}>{row.rank === 1 && <Trophy className="size-4" aria-hidden="true" />}{String(row.rank).padStart(2, '0')}</span></td><td><Link to={`/operators/${row.userId}`} className="results-operator focus-ring"><SolanaAccountIcon address={row.wallet ?? row.userId} size="md" /><span>{row.displayName}</span>{row.userId === portfolio?.userId && <small>You</small>}</Link></td><td>{formatCurrency(row.equity)}</td><td className={Number(row.pnl) >= 0 ? 'text-primary' : 'text-danger'}>{formatCurrency(row.pnl)}</td><td className={Number(row.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}>{formatPercent(row.returnPercent)}</td><td><Link to={`/operators/${row.userId}`} className="results-row-link focus-ring" aria-label={`View ${row.displayName} profile`}><ArrowUpRight className="size-4" aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>}
      </section>
      <footer className="results-footer"><p>Performance is measured against virtual starting capital. No real assets were traded.</p><Link to="/missions" className="results-next-action focus-ring">Find your next mission<ArrowUpRight className="size-4" aria-hidden="true" /></Link></footer>
    </div>
  )
}

function ResultsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="results-error" role="alert"><p>{message}</p><button type="button" className="focus-ring" onClick={onRetry}><RotateCw className="size-4" aria-hidden="true" />Retry</button></div>
}
