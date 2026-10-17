import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowUpRight, ChevronDown, Layers3, Radio, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, formatVirtualBalance } from '../../lib/format'
import type { Mission } from '../../types/mission'
import { HeroPlanetHorizon } from '../../components/HeroPlanetHorizon'
import { CountUpValue } from '../../components/CountUpValue'
import { TicketSurface } from '../../components/TicketSurface'

const GUIDE_DURATION = 0.2
/* MISSION ENTRANCE (from mount)
 *   0ms  Entry action remains available.
 *  40ms  Board heading and mission name settle in.
 * 120ms  Reward label appears.
 * 180ms  Dollar count starts; SOL follows at 240ms.
 * 300ms  Entry and trader counts start.
 * 380ms  Supporting details and mission facts appear.
 * 480ms  Footer settles in; counts finish within 1400ms.
 */
const TIMING = { heading: 40, label: 120, pool: 180, sol: 240, stats: 300, details: 380, footer: 480, countDuration: 1000, fade: 0.2 } as const
const ENTRANCE_SPRING = { type: 'spring' as const, stiffness: 350, damping: 30 }
const statusLabels: Record<Mission['status'], string> = {
  DRAFT: 'Preparing', REGISTRATION: 'Registration open', LOCKED: 'Registration closed',
  ACTIVE: 'In progress', BLACKOUT: 'Final stretch', SETTLING: 'Settling results',
  FINALIZED: 'Results final', CLOSED: 'Completed', CANCELLED: 'Cancelled',
}
// Temporary visual preview values from the supplied reference; never used for payments or orders.
const SEASON_PREVIEW = {
  pool: 2480,
  currency: 'SOL',
  usdValue: 362080,
  entry: '0.05 SOL',
  traders: 8429,
  entryValue: 0.05,
} as const
const guideSteps = [
  { number: '01', icon: Layers3, title: 'Start on equal ground', text: 'Every trader begins with the same virtual balance. Pick your approach and enter the mission.' },
  { number: '02', icon: Radio, title: 'Trade your strategy', text: 'Use real market quotes to build your portfolio. Every fill and price impact counts.' },
  { number: '03', icon: Trophy, title: 'Earn your position', text: 'Compete on portfolio return. Your performance determines your place on the leaderboard.' },
]
function formatTimeLeft(milliseconds: number) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor(minutes / 60) % 24
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

export function FeaturedMission({ mission }: { mission: Mission }) {
  const reducedMotion = useReducedMotion()
  const [guideOpen, setGuideOpen] = useState(false)
  const [stage, setStage] = useState(0)
  const [now, setNow] = useState(Date.now)
  const href = `/missions/${mission.id}`
  const startsAt = new Date(mission.startsAt).getTime()
  const endsAt = new Date(mission.endsAt).getTime()
  const cancelled = mission.status === 'CANCELLED'
  const finished = now >= endsAt || ['SETTLING', 'FINALIZED', 'CLOSED'].includes(mission.status)
  const upcoming = now < startsAt && !finished
  const elapsed = cancelled ? 0 : finished ? 1 : Math.max(0, Math.min(1, (now - startsAt) / Math.max(1, endsAt - startsAt)))
  const windowLabel = cancelled ? 'Mission cancelled' : finished ? 'Window complete' : upcoming ? 'Until the start' : 'Time remaining'
  const timeLeft = cancelled ? 'Cancelled' : finished ? 'Complete' : formatTimeLeft((upcoming ? startsAt : endsAt) - now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (reducedMotion) return
    const delays = [TIMING.heading, TIMING.label, TIMING.pool, TIMING.sol, TIMING.stats, TIMING.details, TIMING.footer]
    const timers = delays.map((delay, index) => window.setTimeout(() => setStage(index + 1), delay))
    return () => timers.forEach(window.clearTimeout)
  }, [reducedMotion])
  const entrance = (minimumStage: number) => ({
    initial: reducedMotion ? false as const : { opacity: 0, y: 8 },
    animate: { opacity: reducedMotion || stage >= minimumStage ? 1 : 0, y: reducedMotion || stage >= minimumStage ? 0 : 8 },
    transition: reducedMotion ? { duration: 0 } : { ...ENTRANCE_SPRING, opacity: { duration: TIMING.fade } },
  })

  return <div className="missions-experience">
    <HeroPlanetHorizon showHorizon={false} />
    <section className="missions-landing" aria-labelledby="missions-heading">
      <m.header className="missions-board-heading" {...entrance(1)}>
        <div><p className="missions-board-eyebrow">Competition board</p><h1 id="missions-heading">Missions</h1></div>
        <button type="button" className="missions-guide-trigger focus-ring" aria-expanded={guideOpen} aria-controls="mission-quick-guide" onClick={() => setGuideOpen(open => !open)}>How it works<ChevronDown className="size-4" aria-hidden="true" style={{ transform: guideOpen ? 'rotate(180deg)' : undefined }} /></button>
      </m.header>
      <article className="missions-spotlight" aria-labelledby="spotlight-title">
        <div className="missions-board-pool missions-pool-ticket">
          <div className="missions-board-reward">
            <m.p className="missions-spotlight-label" {...entrance(2)}>Season reward pool</m.p>
            <m.p className="missions-spotlight-value" {...entrance(3)}><span className="missions-pool-number">$<CountUpValue value={SEASON_PREVIEW.usdValue} format="grouped" delayMs={TIMING.pool} durationMs={TIMING.countDuration} reserveWidth /></span><span className="missions-pool-currency">USD</span></m.p>
            <m.p className="missions-capital-caption" {...entrance(4)}>≈ <CountUpValue value={SEASON_PREVIEW.pool} format="grouped" delayMs={TIMING.sol} durationMs={TIMING.countDuration} reserveWidth /> {SEASON_PREVIEW.currency}</m.p>
          </div>
          <TicketSurface className="missions-board-entry missions-entry-ticket">
            <div className="missions-ticket-content">
            <m.p className="missions-entry-label" {...entrance(2)}><span>Falcon / Arena pass</span></m.p>
            <m.h3 className="missions-ticket-title" {...entrance(3)}>Admit one.</m.h3>
            <m.dl className="missions-spotlight-stats" {...entrance(5)}><div><dt>Entry</dt><dd><CountUpValue value={SEASON_PREVIEW.entryValue} format="decimal" delayMs={TIMING.stats} durationMs={TIMING.countDuration} reserveWidth /> SOL</dd></div><div><dt>Traders</dt><dd><CountUpValue value={SEASON_PREVIEW.traders} format="grouped" delayMs={TIMING.stats} durationMs={TIMING.countDuration} reserveWidth /></dd></div></m.dl>
            <Link to={href} className="app-button focus-ring missions-spotlight-button"><span>Claim your place</span><ArrowUpRight aria-hidden="true" /></Link>
            <m.p className="missions-spotlight-footnote" {...entrance(6)}>Entry fees go directly into the community reward pool.</m.p>
            <div className="missions-ticket-bottom" aria-hidden="true"><span>Trade. Compete. Rank.</span><span className="missions-ticket-barcode" /></div>
            </div>
          </TicketSurface>
        </div>
        <div className="missions-info-rail">
          <m.div className="missions-board-mission" {...entrance(6)}>
            <p className="missions-board-eyebrow">Mission dossier <span className="missions-brief-index" aria-hidden="true">01</span></p>
            <h2 id="spotlight-title">{mission.name}</h2>
            <span className="missions-board-status">{statusLabels[mission.status]}</span>
          </m.div>
          <m.div className="missions-facts" {...entrance(6)}>
            <div><small className="missions-fact-index" aria-hidden="true">01 / MARKETS</small><Radio aria-hidden="true" /><span>Market access<strong>{mission.allowDynamicMarkets ? 'Discover & trade' : `${mission.marketCount} ${mission.marketCount === 1 ? 'market' : 'markets'}`}</strong></span></div>
            <div><small className="missions-fact-index" aria-hidden="true">02 / CAPITAL</small><Layers3 aria-hidden="true" /><span>Starting capital<strong>{formatVirtualBalance(mission.startingBalance)} virtual</strong></span></div>
            <div><small className="missions-fact-index" aria-hidden="true">03 / OBJECTIVE</small><Trophy aria-hidden="true" /><span>Ranked by<strong>Portfolio return</strong></span></div>
          </m.div>
          <m.div className="missions-schedule" {...entrance(7)}>
            <div className="missions-window-heading">
              <div><p className="missions-board-eyebrow">Competition window</p><p className="missions-window-counter"><strong>{timeLeft}</strong><span>{windowLabel}</span></p></div>
              <span className="missions-window-elapsed">{Math.round(elapsed * 100)}% elapsed</span>
            </div>
            <div className="missions-window-track" role="progressbar" aria-label="Mission time elapsed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsed * 100)}>
              <span style={{ transform: `scaleX(${reducedMotion || stage >= 7 ? elapsed : 0})` }} />
            </div>
            <dl className="missions-board-dates">
              <div><dt>Starts</dt><dd><time dateTime={mission.startsAt}>{formatDate(mission.startsAt)}</time></dd></div>
              <div><dt>Ends</dt><dd><time dateTime={mission.endsAt}>{formatDate(mission.endsAt)}</time></dd></div>
            </dl>
          </m.div>
          <m.footer className="missions-board-footer" {...entrance(7)}><p>Equal starting capital. Ranked by performance.</p><Link to={href} className="focus-ring">View mission<ArrowUpRight className="size-4" aria-hidden="true" /></Link></m.footer>
        </div>
      </article>
    </section>
    <AnimatePresence initial={false}>
      {guideOpen && <m.section id="mission-quick-guide" className="missions-quick-guide" aria-label="How missions work" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }} transition={{ duration: reducedMotion ? 0 : GUIDE_DURATION }}>
        <div className="missions-guide-heading"><div><p>Simple by design</p><h2>Three moves. One mission.</h2></div><Link to={href} className="focus-ring">View mission details<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
        <div className="missions-guide-steps">{guideSteps.map(step => <div key={step.number}><div className="missions-guide-step-top"><span>{step.number}</span><step.icon aria-hidden="true" /></div><h3>{step.title}</h3><p>{step.text}</p></div>)}</div>
        <button type="button" className="missions-guide-close focus-ring" onClick={() => { setGuideOpen(false); document.querySelector<HTMLButtonElement>('.missions-guide-trigger')?.focus() }}>Less detail<ArrowDown className="size-3.5" aria-hidden="true" /></button>
      </m.section>}
    </AnimatePresence>
  </div>
}

export function FeaturedMissionSkeleton() {
  return <div className="missions-experience" aria-busy="true" aria-label="Loading featured mission">
    <HeroPlanetHorizon showHorizon={false} />
    <div className="missions-landing missions-loading-layout motion-safe:animate-pulse">
      <div className="missions-loading-copy" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="missions-loading-card" aria-hidden="true"><span /><span /><span /></div>
    </div>
  </div>
}
