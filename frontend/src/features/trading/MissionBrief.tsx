import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Clock3, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../../providers/auth-context'
import { useClock } from '../../hooks/useClock'
import { useCountdown } from '../../hooks/useCountdown'
import { PrizePanel } from '../missions/PrizePanel'
import { WalletAuthButton } from '../../components/WalletAuthButton'
import { SolanaAccountIcon } from '../../components/SolanaAccountIcon'
import { formatCurrency, formatDate, formatPercent, formatVirtualBalance } from '../../lib/format'
import type { CashEntryInput, Mission } from '../../types/mission'
import type { LeaderboardRow } from '../../types/trading'
import { StatusBadge } from '../missions/StatusBadge'
import '../../pages/MissionsPage.css'
import { TokenIcon } from './TokenIcon'
import defaultTokenIcons from './default-token-icons.json'
import './MissionBrief.css'

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

  return <div className="mission-brief">
    <header className="mission-brief-header">
      <div className="mission-brief-kicker"><span>{reward ? 'Prize mission' : 'Free practice mission'}</span><StatusBadge status={mission.status} /></div>
      <h1>{mission.name}</h1>
      <p>{mission.allowDynamicMarkets ? 'Discover coins. Build your portfolio. Climb the leaderboard.' : 'Trade the roster. Build your portfolio. Climb the leaderboard.'}</p>
    </header>
    <div className="mission-brief-grid">
      <div className="mission-brief-main">
        <dl className="mission-brief-stats">
          <div><dt><Clock3 size={15} aria-hidden="true" />{live ? 'Time remaining' : 'Starts in'}</dt><dd>{countdown}</dd></div>
          <div><dt><Users size={15} aria-hidden="true" />Traders</dt><dd>{mission.operatorCount}</dd></div>
        </dl>
        <section className="mission-brief-markets" aria-labelledby="mission-markets-title">
          <div className="mission-section-heading"><h2 id="mission-markets-title">On your radar</h2><span>{mission.allowDynamicMarkets ? 'Add more in the terminal' : `${mission.marketCount} markets`}</span></div>
          <div className="mission-brief-tokens">{mission.markets.slice(0, 6).map(market => <span key={market.id}><TokenIcon symbol={market.symbol} iconUrl={(defaultTokenIcons as Record<string, string>)[market.mintAddress]} />{market.symbol}</span>)}{mission.markets.length > 6 && <span>+{mission.markets.length - 6} more</span>}</div>
        </section>
        <section className="mission-standings mission-brief-standings" aria-busy={leaderboardLoading} aria-labelledby="mission-standings-title">
          <div className="mission-section-heading"><h2 id="mission-standings-title">{live ? 'Leading the mission' : 'Leaderboard'}</h2><span>{leaderboardHidden ? 'Blackout' : 'Top 3 · By return'}</span></div>
          {leaderboardLoading ? <div className="mission-standings-skeleton motion-safe:animate-pulse" aria-label="Loading leaderboard">{[0, 1, 2].map(i => <span key={i} />)}</div>
            : leaderboardError ? <p className="mission-panel-message text-danger" role="alert">{leaderboardError} Standings refresh automatically.</p>
            : leaderboardHidden ? <p className="mission-panel-message">Rankings are hidden during the final blackout. Trading remains open until the mission ends.</p>
            : leaderboard.length === 0 ? <p className="mission-panel-message">No scores yet. Be the first to join.</p>
            : <div className="mission-standings-scroll"><table><thead><tr><th scope="col">Rank</th><th scope="col">Trader</th><th scope="col">Portfolio</th><th scope="col">Return</th></tr></thead><tbody>{leaderboard.slice(0, 3).map(row => <tr key={row.userId}><td><span className={row.rank <= 3 ? 'mission-podium-rank' : ''}>{row.rank.toString().padStart(2, '0')}</span></td><td><span className="mission-standing-trader"><SolanaAccountIcon address={row.wallet ?? row.userId} size="sm" /><span>{row.displayName}</span></span></td><td>{formatCurrency(row.equity)}</td><td className={Number(row.returnPercent) >= 0 ? 'text-primary' : 'text-danger'}>{formatPercent(row.returnPercent)}</td></tr>)}</tbody></table></div>}
        </section>
        <details className="mission-brief-rules" id="mission-rules">
          <summary className="focus-ring">Rules & schedule<ChevronDown size={16} aria-hidden="true" /></summary>
          <div>
            <p>Everyone starts with {formatVirtualBalance(mission.startingBalance)} in virtual funds. Rankings are based on portfolio return. Trading closes when the mission ends.</p>
            <dl><div><dt>Starts</dt><dd>{formatDate(mission.startsAt)}</dd></div><div><dt>Ends</dt><dd>{formatDate(mission.endsAt)}</dd></div></dl>
            <p>{reward ? 'Prize eligibility and full terms are listed below.' : 'Practice only. No cash prize or real funds required.'}</p>
          </div>
        </details>
      </div>
      <aside className="mission-brief-entry" id="mission-entry" aria-labelledby="mission-entry-title">
        <p className="mission-entry-eyebrow">Your starting balance</p>
        <h2 id="mission-entry-title">{formatVirtualBalance(mission.startingBalance)}<span>virtual USDC</span></h2>
        <p className="mission-brief-entry-copy">{reward ? 'Join the competition with equal starting capital.' : 'A fresh portfolio. Your strategy. Free to enter.'}</p>
          {wallet && <div className="mission-entry-wallet"><p>Your wallet</p><div><SolanaAccountIcon address={wallet} size="sm" /><span title={wallet}>{wallet.slice(0, 5)}…{wallet.slice(-4)}</span><span className="mission-wallet-status">Connected</span></div></div>}
          {entryHref ? <Link to={entryHref} className="app-button focus-ring mission-entry-button">Open trading terminal<ArrowRight className="size-4" aria-hidden="true" /></Link> : requiresAuthentication ? <div className="mission-entry-auth"><p>Connect your wallet to join. Trading uses virtual funds.</p><WalletAuthButton /></div> : <>
            {reward && <div className="mission-entry-eligibility"><label>Country of residence<select value={country} onChange={event => setCountry(event.target.value)} className="app-field focus-ring"><option value="">Select an eligible country</option>{reward.eligibleCountries.map(code => <option key={code} value={code}>{new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code}</option>)}</select></label><label className="mission-entry-terms"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="focus-ring accent-primary" />I am 18 or older, reside in the selected country, and accept the published mission rules and eligibility checks.</label><p>Organizer approval is required before trading.</p></div>}
            {error && <p className="mission-entry-error" role="alert">{error}</p>}
            <button type="button" onClick={() => onDeploy(reward ? { country, adult: accepted, acceptedRules: accepted, rulesVersion: reward.rulesVersion } : undefined)} disabled={!deployable || deploying || Boolean(reward && (!accepted || !country))} aria-busy={deploying} className="app-button focus-ring mission-entry-button">
              {deploying ? 'Joining…' : deployable ? reward ? 'Register free' : 'Join mission' : 'Entry closed'}<ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </>}

        <p className="mission-brief-disclaimer"><ShieldCheck size={15} aria-hidden="true" />{reward ? 'Virtual trading · Sponsor-funded prizes' : 'Virtual funds only · No cash prize'}</p>
      </aside>
    </div>
    {reward && <div className="mission-overview-prizes"><PrizePanel mission={mission} /></div>}
  </div>
}
