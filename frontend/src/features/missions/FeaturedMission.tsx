import { m, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, formatVirtualBalance } from '../../lib/format'
import type { Mission } from '../../types/mission'
import { HeroPlanetHorizon } from '../../components/HeroPlanetHorizon'
import { CountUpValue } from '../../components/CountUpValue'
import { TicketSurface } from '../../components/TicketSurface'

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
/* BRIEF OPENING (from click)
 *   0ms  The panel expands as the document slides gently into place.
 *  80ms  Assignment and clock fade in together.
 * 140ms  Footer follows; the panel settles at 480ms.
 * Closing reverses from the current position in 300ms.
 */
const BRIEF_TIMING = { content: 0.08, footer: 0.14, open: 0.48, close: 0.3, fade: 0.22 } as const
const BRIEF_EASE = [0.22, 1, 0.36, 1] as const
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
function MissionCountdown({ milliseconds, duration, label }: { milliseconds: number; duration: number; label: string }) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  const units = [
    { label: 'D', name: 'days', value: days, progress: days / Math.max(1, Math.ceil(duration / 86_400_000)) },
    { label: 'H', name: 'hours', value: hours, progress: hours / 24 },
    { label: 'M', name: 'minutes', value: minutes, progress: minutes / 60 },
  ]
  return <div className="missions-countdown" role="timer" aria-label={`${label}: ${days} days, ${hours} hours, ${minutes} minutes`}>
    {units.map((unit, index) => <div className="missions-countdown-unit" key={unit.label} aria-hidden="true">
      <div className="missions-countdown-dial">
        <svg className="missions-countdown-ring" viewBox="0 0 120 120" fill="none">
          {Array.from({ length: 41 }, (_, tick) => {
            const angle = (120 + tick * 7.5) * Math.PI / 180
            const inner = tick % 5 === 0 ? 50 : 53
            return <line key={tick} className={tick / 40 <= unit.progress && unit.value > 0 ? 'missions-countdown-tick is-filled' : 'missions-countdown-tick'}
              x1={60 + Math.cos(angle) * inner} y1={60 + Math.sin(angle) * inner}
              x2={60 + Math.cos(angle) * 57} y2={60 + Math.sin(angle) * 57} />
          })}
          <circle className="missions-countdown-track" cx="60" cy="60" r="44" pathLength="100" strokeDasharray="83.333 100" transform="rotate(120 60 60)" />
          <circle className="missions-countdown-progress" cx="60" cy="60" r="44" pathLength="100" strokeDasharray={`${83.333 * Math.min(1, unit.progress)} 100`} opacity={unit.value > 0 ? 1 : 0} transform="rotate(120 60 60)" />
        </svg>
        <div className="missions-countdown-digits"><strong>{String(unit.value).padStart(2, '0')}</strong></div>
        <span className="missions-countdown-symbol">{unit.label}</span>
      </div>
      <div className="missions-countdown-unit-label"><span>0{index + 1}</span>{unit.name}</div>
    </div>)}
  </div>
}

export function FeaturedMission({ mission }: { mission: Mission }) {
  const reducedMotion = useReducedMotion()
  const [briefOpen, setBriefOpen] = useState(false)
  const briefId = useId()
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
  const remaining = cancelled || finished ? 0 : Math.max(0, (upcoming ? startsAt : endsAt) - now)
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
  const briefEntrance = (delay: number) => ({
    initial: false as const,
    animate: { opacity: briefOpen ? 1 : 0, y: briefOpen || reducedMotion ? 0 : 6 },
    transition: { duration: reducedMotion ? 0 : BRIEF_TIMING.fade, ease: BRIEF_EASE, delay: briefOpen && !reducedMotion ? delay : 0 },
  })

  return <div className="missions-experience">
    <HeroPlanetHorizon showHorizon={false} />
    <m.header className="missions-board-heading" {...entrance(1)}>
      <div><p className="missions-board-eyebrow">Competition board</p><h1 id="missions-heading">Missions</h1></div>
    </m.header>
    <section className="missions-landing" aria-labelledby="missions-heading">
      <article className="missions-spotlight" aria-label={mission.name}>
        <div className="missions-board-pool missions-pool-ticket">
          <div className="missions-board-reward">
            <m.p className="missions-spotlight-label" {...entrance(2)}>Season reward pool</m.p>
            <m.p className="missions-spotlight-value" {...entrance(3)}><span className="missions-pool-number">$<CountUpValue value={SEASON_PREVIEW.usdValue} format="grouped" delayMs={TIMING.pool} durationMs={TIMING.countDuration} reserveWidth /></span><span className="missions-pool-currency">USD</span></m.p>
            <m.p className="missions-capital-caption" {...entrance(4)}>≈ <CountUpValue value={SEASON_PREVIEW.pool} format="grouped" delayMs={TIMING.sol} durationMs={TIMING.countDuration} reserveWidth /> {SEASON_PREVIEW.currency}</m.p>
          </div>
          <TicketSurface className="missions-board-entry missions-entry-ticket" shading={false}>
            <div className="missions-ticket-content">
            <m.h3 className="missions-ticket-title" {...entrance(3)}><span>Admit one.</span></m.h3>
            <m.dl className="missions-spotlight-stats" {...entrance(5)}><div><dt>Entry</dt><dd><CountUpValue value={SEASON_PREVIEW.entryValue} format="decimal" delayMs={TIMING.stats} durationMs={TIMING.countDuration} reserveWidth /> SOL</dd></div><div><dt>Traders</dt><dd><CountUpValue value={SEASON_PREVIEW.traders} format="grouped" delayMs={TIMING.stats} durationMs={TIMING.countDuration} reserveWidth /></dd></div></m.dl>
            <Link to={href} className="app-button focus-ring missions-spotlight-button"><span>Claim your place</span><ArrowUpRight aria-hidden="true" /></Link>
            <m.p className="missions-spotlight-footnote" {...entrance(6)}>Entry fees go directly into the community reward pool.</m.p>
            <div className="missions-ticket-bottom" aria-hidden="true"><span>Trade. Compete. Earn.</span><span className="missions-ticket-barcode" /></div>
            </div>
          </TicketSurface>
        </div>
        <div className="missions-brief-folder" data-open={briefOpen}>
          <div className="missions-brief-rail">
          <button type="button" className="missions-dossier-tab missions-brief-toggle" aria-expanded={briefOpen} aria-controls={briefId} onClick={() => setBriefOpen(open => !open)}>
            <span>Mission details</span><ChevronDown aria-hidden="true" />
          </button>
          <span className="missions-brief-rule" aria-hidden="true" />
          </div>
          <m.div id={briefId} className="missions-dossier-reveal" role="region" aria-label="Mission briefing" aria-hidden={!briefOpen} inert={!briefOpen}
            initial={false} animate={{ height: briefOpen ? 'auto' : 0 }}
            transition={{ duration: reducedMotion ? 0 : briefOpen ? BRIEF_TIMING.open : BRIEF_TIMING.close, ease: BRIEF_EASE }}>
            <m.div className="missions-dossier" initial={false} animate={{ y: briefOpen || reducedMotion ? 0 : -14, opacity: briefOpen ? 1 : 0 }}
              transition={{ duration: reducedMotion ? 0 : briefOpen ? BRIEF_TIMING.open : BRIEF_TIMING.close, ease: BRIEF_EASE, opacity: { duration: reducedMotion ? 0 : BRIEF_TIMING.fade } }}>
              <div className="missions-dossier-binding" aria-hidden="true"><i /><span>MISSION BRIEF / FALCON</span><i /><i /></div>
              <header className="missions-dossier-header">
                <div className="missions-dossier-topline"><span>Mission brief.</span><span>FILE / {mission.id.slice(0, 8).toUpperCase()}</span></div>
                <div className="missions-dossier-titleline">
                  <h2 id="spotlight-title">{mission.name}</h2>
                  <span className="missions-dossier-stamp">{statusLabels[mission.status]}</span>
                </div>
              </header>
          <m.section className="missions-dossier-orders" aria-label="Mission briefing" {...briefEntrance(BRIEF_TIMING.content)}>
            <p className="missions-dossier-section">01 Your assignment</p>
            <h3>Trade with intent.<br />Finish ahead.</h3>
            <dl className="missions-dossier-facts">
              <div className="missions-dossier-capital"><dt>Capital allocated</dt><dd>{formatVirtualBalance(mission.startingBalance)}<span>Virtual funds / equal start</span></dd></div>
              <div><dt>Market access</dt><dd>{mission.allowDynamicMarkets ? 'Discover & trade' : `${mission.marketCount} ${mission.marketCount === 1 ? 'market' : 'markets'}`}</dd></div>
              <div><dt>Success measured by</dt><dd>Portfolio return</dd></div>
            </dl>
          </m.section>
          <m.div className="missions-schedule" {...briefEntrance(BRIEF_TIMING.content)}>
            <div className="missions-window-heading">
              <div><p className="missions-dossier-section">02 Mission window</p><p className="missions-countdown-caption">{windowLabel}</p></div>
              <span className="missions-window-elapsed">{Math.round(elapsed * 100)}% elapsed</span>
            </div>
            <MissionCountdown milliseconds={remaining} duration={Math.max(endsAt - startsAt, remaining)} label={windowLabel} />
            <dl className="missions-board-dates">
              <div><dt>Starts</dt><dd><time dateTime={mission.startsAt}>{formatDate(mission.startsAt)}</time></dd></div>
              <div><dt>Ends</dt><dd><time dateTime={mission.endsAt}>{formatDate(mission.endsAt)}</time></dd></div>
            </dl>
          </m.div>
          <m.footer className="missions-dossier-footer" {...briefEntrance(BRIEF_TIMING.footer)}>
            <p><span aria-hidden="true">↳</span> Equal starting capital. Ranked by performance.</p>
            <Link to={href} className="focus-ring">Read full brief<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          </m.footer>
            </m.div>
          </m.div>
        </div>
      </article>
    </section>
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
