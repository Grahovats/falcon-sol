import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock3, Coins, Radio, ShieldCheck, Trophy, Users } from 'lucide-react'
import { useAuth } from '../../providers/auth-context'
import { useClock } from '../../hooks/useClock'
import { useCountdown } from '../../hooks/useCountdown'
import { PrizePanel } from '../missions/PrizePanel'
import { WalletAuthButton } from '../../components/WalletAuthButton'
import { SolanaAccountIcon } from '../../components/SolanaAccountIcon'
import { formatCurrency, formatDate, formatPercent, formatVirtualBalance } from '../../lib/format'
import type { CashEntryInput, Mission } from '../../types/mission'
import type { LeaderboardRow } from '../../types/trading'
import { usdc } from '../../lib/prize-format'
import { StatusBadge } from '../missions/StatusBadge'
import '../../pages/MissionsPage.css'

interface MissionBriefProps {
  mission: Mission
  deploying: boolean
  error: string | null
  onDeploy: (input?: CashEntryInput) => void
  entryHref?: string
  requiresAuthentication?: boolean
  leaderboard?: LeaderboardRow[]
  leaderboardLoading?: boolean
  leaderboardError?: string
  leaderboardHidden?: boolean
}

export function MissionBrief({ mission, deploying, error, onDeploy, entryHref, requiresAuthentication = false, leaderboard = [], leaderboardLoading = false, leaderboardError, leaderboardHidden = false }: MissionBriefProps) {
  const auth = useAuth()
  const wallet = auth.user?.wallet
  const [country, setCountry] = useState('')
  const [accepted, setAccepted] = useState(false)
  const now = useClock()
  const reward = mission.rewards
  const cashOpen = !reward || (reward.mode === 'SPONSORED' && reward.state === 'READY' && reward.termsApproved && now < new Date(reward.registrationClosesAt).getTime())
  const deployable = cashOpen && (mission.status === 'REGISTRATION' || mission.status === 'ACTIVE')
  const live = mission.status === 'ACTIVE' || mission.status === 'BLACKOUT'
  const countdown = useCountdown(live ? mission.endsAt : mission.startsAt)

  return <div className="mission-overview-page">
    <header className="mission-overview-hero">
      <div className="mission-hero-copy">
        <div className="mission-hero-eyebrow"><span>Trading competition</span><StatusBadge status={mission.status} /></div>
        <h1>{mission.name}</h1>
        <p>{mission.description ?? 'Equal virtual capital. Real market prices. Compete for the top of the leaderboard.'}</p>
      </div>
      <div className="mission-hero-bottom"><dl className="mission-hero-stats">
        <div><Clock3 aria-hidden="true" /><dt>{live ? 'Time remaining' : 'Starts in'}</dt><dd>{countdown}</dd></div>
        <div><Users aria-hidden="true" /><dt>Participants</dt><dd>{mission.operatorCount}</dd></div>
        <div><Coins aria-hidden="true" /><dt>Virtual capital</dt><dd>{formatVirtualBalance(mission.startingBalance)}</dd></div>
        <div><ShieldCheck aria-hidden="true" /><dt>Entry</dt><dd>{!reward || reward.mode === 'SPONSORED' ? 'Free' : 'Unavailable'}</dd></div>
        <div><Trophy aria-hidden="true" /><dt>{reward ? 'Prize pool' : 'Mission type'}</dt><dd>{reward ? usdc(reward.prizePool) : 'Practice'}</dd></div>
      </dl><div className="mission-hero-actions"><a href="#mission-entry" className="app-button focus-ring mission-hero-join">{entryHref ? 'Open terminal' : 'Join mission'}<ArrowRight className="size-4" aria-hidden="true" /></a><a href="#mission-rules" className="focus-ring mission-hero-rules">View rules</a></div></div>
    </header>
    <nav className="mission-overview-nav" aria-label="Mission sections">
      <a className="focus-ring" href="#mission-overview">Overview</a>
      <a className="focus-ring" href="#mission-standings">Leaderboard</a>
      <a className="focus-ring" href="#mission-markets">Markets</a>
      <a className="focus-ring" href="#mission-rules">Rules</a>
    </nav>
    <div className="mission-overview-layout">
      <div className="mission-overview-main">
        <section className="mission-overview-panel" id="mission-overview">
          <h2>Mission overview</h2>
          <p className="mission-overview-description">Everyone starts with {formatVirtualBalance(mission.startingBalance)} in virtual capital. Trade at real market prices and compete on portfolio performance.</p>
          <dl className="mission-overview-dates">
            <div><CalendarDays aria-hidden="true" /><dt>Starts</dt><dd>{formatDate(mission.startsAt)}</dd></div>
            <div><Clock3 aria-hidden="true" /><dt>Ends</dt><dd>{formatDate(mission.endsAt)}</dd></div>
            <div><Coins aria-hidden="true" /><dt>Starting capital</dt><dd>{formatVirtualBalance(mission.startingBalance)} virtual</dd></div>
            <div><Radio aria-hidden="true" /><dt>Pricing</dt><dd>Real market quotes</dd></div>
          </dl>
        </section>
        <section className="mission-overview-panel mission-standings" id="mission-standings" aria-busy={leaderboardLoading}>
          <div className="mission-section-heading"><h2>{live ? 'Live leaderboard' : 'Leaderboard'}</h2><span>{leaderboardHidden ? 'Blackout' : 'By portfolio return'}</span></div>
          {leaderboardLoading ? <div className="mission-standings-skeleton motion-safe:animate-pulse" aria-label="Loading leaderboard">{[0, 1, 2].map(i => <span key={i} />)}</div>
            : leaderboardError ? <p className="mission-panel-message text-danger" role="alert">{leaderboardError} Standings refresh automatically.</p>
            : leaderboardHidden ? <p className="mission-panel-message">Rankings are hidden during the final blackout. Trading remains open until the mission ends.</p>
            : leaderboard.length === 0 ? <p className="mission-panel-message">The leaderboard is open. Join the mission to set the first score.</p>
            : <div className="mission-standings-scroll"><table><thead><tr><th scope="col">Rank</th><th scope="col">Trader</th><th scope="col">Portfolio</th><th scope="col">Return</th></tr></thead><tbody>{leaderboard.slice(0, 8).map(row => <tr key={row.userId}><td><span className={row.rank <= 3 ? 'mission-podium-rank' : ''}>{row.rank.toString().padStart(2, '0')}</span></td><td><span className="mission-standing-trader"><SolanaAccountIcon address={row.wallet ?? row.userId} size="sm" /><span>{row.displayName}</span></span></td><td>{formatCurrency(row.equity)}</td><td className={Number(row.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}>{formatPercent(row.returnPercent)}</td></tr>)}</tbody></table></div>}
        </section>
        <section className="mission-overview-panel" id="mission-markets">
          <div className="mission-section-heading"><h2>Market roster</h2><span>{mission.marketCount} markets</span></div>
          <div className="mission-market-roster">{mission.markets.map(market => <span key={market.id}><Radio className="size-3.5" aria-hidden="true" />{market.symbol}</span>)}</div>
          {mission.allowDynamicMarkets && <p className="mission-panel-note">You can discover and add eligible coins from the trading terminal.</p>}
        </section>
        <section className="mission-overview-panel" id="mission-rules">
          <h2>Mission rules</h2>
          <div className="mission-rules-grid">
            <div><Coins aria-hidden="true" /><h3>Equal starting capital</h3><p>Every trader begins with the same virtual balance.</p></div>
            <div><Radio aria-hidden="true" /><h3>Real market prices</h3><p>Execution uses current market quotes.</p></div>
            <div><ShieldCheck aria-hidden="true" /><h3>Virtual funds</h3><p>No real funds are used for trading.</p></div>
            <div><Clock3 aria-hidden="true" /><h3>Fixed trading window</h3><p>Trading closes when the mission ends.</p></div>
            <div><Trophy aria-hidden="true" /><h3>Ranked by return</h3><p>Portfolio performance determines your rank.</p></div>
          </div>
        </section>
      </div>
      <aside className="mission-overview-sidebar">
        <section id="mission-entry" className="mission-overview-panel mission-entry-panel" aria-labelledby="mission-entry-title">
          <p className="mission-entry-eyebrow">Your next move</p>
          <h2 id="mission-entry-title">Enter this mission</h2>
          <dl className="mission-entry-details"><div><dt>Entry</dt><dd>{reward ? reward.mode === 'SPONSORED' ? 'Free entry' : 'Unavailable' : 'Free'}</dd></div><div><dt>Starting balance</dt><dd>{formatVirtualBalance(mission.startingBalance)} <span>virtual</span></dd></div><div><dt>Participants</dt><dd>{mission.operatorCount}</dd></div><div><dt>Markets</dt><dd>{mission.allowDynamicMarkets ? 'Discover & trade' : mission.marketCount}</dd></div></dl>
          {wallet && <div className="mission-entry-wallet"><p>Your wallet</p><div><SolanaAccountIcon address={wallet} size="sm" /><span title={wallet}>{wallet.slice(0, 5)}…{wallet.slice(-4)}</span><span className="mission-wallet-status">Connected</span></div></div>}
          {entryHref ? <Link to={entryHref} className="app-button focus-ring mission-entry-button">Open trading terminal<ArrowRight className="size-4" aria-hidden="true" /></Link> : requiresAuthentication ? <div className="mission-entry-auth"><p>Connect your wallet to join. Trading uses virtual funds.</p><WalletAuthButton /></div> : <>
            {reward && <div className="mission-entry-eligibility"><label>Country of residence<select value={country} onChange={event => setCountry(event.target.value)} className="app-field focus-ring"><option value="">Select an eligible country</option>{reward.eligibleCountries.map(code => <option key={code} value={code}>{new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code}</option>)}</select></label><label className="mission-entry-terms"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="focus-ring accent-primary" />I am 18 or older, reside in the selected country, and accept the published mission rules and eligibility checks.</label><p>Organizer approval is required before trading.</p></div>}
            {error && <p className="mission-entry-error" role="alert">{error}</p>}
            <button type="button" onClick={() => onDeploy(reward ? { country, adult: accepted, acceptedRules: accepted, rulesVersion: reward.rulesVersion } : undefined)} disabled={!deployable || deploying || Boolean(reward && (!accepted || !country))} aria-busy={deploying} className="app-button focus-ring mission-entry-button">
              {deploying ? 'Joining…' : deployable ? reward ? 'Register free' : 'Join mission' : 'Entry closed'}<ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </>}
          <p className="mission-entry-footnote">Same capital. Same rules. Your edge.</p>
        </section>
        {reward ? <div className="mission-overview-prizes"><PrizePanel mission={mission} /></div> : <section className="mission-overview-panel mission-format-panel"><div className="mission-section-heading"><h2>Competition format</h2><Trophy className="size-4 text-primary" aria-hidden="true" /></div><dl className="mission-entry-details"><div><dt>Format</dt><dd>Individual</dd></div><div><dt>Ranking</dt><dd>Portfolio return</dd></div><div><dt>Capital</dt><dd>Virtual funds</dd></div><div><dt>Cash prize</dt><dd>None · Practice</dd></div></dl><p className="mission-panel-note">A free mission to test your strategy against other traders. Market prices are real; trading funds are simulated.</p></section>}
      </aside>
    </div>
  </div>
}
