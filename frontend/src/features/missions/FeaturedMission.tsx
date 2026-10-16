import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowUpRight, ChevronDown, Layers3, Radio, Sparkle, Trophy, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatVirtualBalance } from '../../lib/format'
import type { Mission } from '../../types/mission'

/* MISSION PAGE STORYBOARD
 *   0ms  Primary links and mission information are usable.
 *  40ms  Headline settles upward, followed by supporting copy.
 * 100ms  Mission panel settles into place.
 * 180ms  Compact mission facts appear. Refetches never replay this sequence.
 */
const TIMING = { headline: 40, panel: 100, facts: 180, fade: 0.2, guide: 0.2 } as const
const SPRING = { type: 'spring' as const, stiffness: 330, damping: 30, mass: 0.8 }
// Temporary visual preview values from the supplied reference; never used for payments or orders.
const SEASON_PREVIEW = {
  pool: '2,480',
  currency: 'SOL',
  usdValue: '≈ $362,080 USD',
  entry: '0.05 SOL',
  traders: '8,429',
} as const
const guideSteps = [
  { number: '01', icon: Layers3, title: 'Start on equal ground', text: 'Every trader begins with the same virtual balance. Pick your approach and enter the mission.' },
  { number: '02', icon: Radio, title: 'Trade your strategy', text: 'Use real market quotes to build your portfolio. Every fill and price impact counts.' },
  { number: '03', icon: Trophy, title: 'Earn your position', text: 'Compete on portfolio return. Your performance determines your place on the leaderboard.' },
]

export function FeaturedMission({ mission }: { mission: Mission }) {
  const reducedMotion = useReducedMotion()
  const [stage, setStage] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)
  const href = `/missions/${mission.id}`
  const motionReady = (minimum: number) => reducedMotion || stage >= minimum

  useEffect(() => {
    if (reducedMotion) return
    const timers = [
      window.setTimeout(() => setStage(1), TIMING.headline),
      window.setTimeout(() => setStage(2), TIMING.panel),
      window.setTimeout(() => setStage(3), TIMING.facts),
    ]
    return () => timers.forEach(window.clearTimeout)
  }, [reducedMotion])

  return <div className="missions-experience">
    <section className="missions-landing" aria-labelledby="missions-heading">
      <div className="missions-landing-copy">
        <m.h1 id="missions-heading" initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: motionReady(1) ? 1 : 0, y: motionReady(1) ? 0 : 12 }} transition={reducedMotion ? { duration: 0 } : SPRING}>Trade. Compete.<br /><span>Earn your rank.</span></m.h1>
        <p>Real markets. Equal starting capital. A place to turn your trading instincts into a measurable edge.</p>
        <div className="missions-landing-actions">
          <Link to={href} className="app-button focus-ring missions-explore-button"><span>Explore mission</span><ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          <button type="button" className="missions-guide-trigger focus-ring" aria-expanded={guideOpen} aria-controls="mission-quick-guide" onClick={() => setGuideOpen(open => !open)}>How it works<ChevronDown className="size-4" aria-hidden="true" style={{ transform: guideOpen ? 'rotate(180deg)' : undefined }} /></button>
        </div>
      </div>
      <m.article className="missions-spotlight" aria-labelledby="spotlight-title" initial={reducedMotion ? false : { y: 14 }} animate={{ y: motionReady(2) ? 0 : 14 }} transition={reducedMotion ? { duration: 0 } : SPRING}>
        <h2 id="spotlight-title" className="sr-only">Season reward pool</h2>
        <div className="missions-spotlight-label"><span>Season reward pool</span><Sparkle aria-hidden="true" /></div>
        <p className="missions-spotlight-value">{SEASON_PREVIEW.pool}<span>{SEASON_PREVIEW.currency}</span></p>
        <p className="missions-capital-caption">{SEASON_PREVIEW.usdValue}</p>
        <dl className="missions-spotlight-stats"><div><dt>Entry</dt><dd>{SEASON_PREVIEW.entry}</dd></div><div><dt>Traders</dt><dd>{SEASON_PREVIEW.traders}</dd></div></dl>
        <Link to={href} className="app-button focus-ring missions-spotlight-button"><Wallet aria-hidden="true" /><span>Join season for {SEASON_PREVIEW.entry}</span></Link>
        <p className="missions-spotlight-footnote">Entry fees go directly into the community reward pool.</p>
      </m.article>
      <m.div className="missions-facts" initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: motionReady(3) ? 1 : 0, y: motionReady(3) ? 0 : 6 }} transition={reducedMotion ? { duration: 0 } : { ...SPRING, opacity: { duration: TIMING.fade } }}>
        <div><Radio aria-hidden="true" /><span>Market access<strong>{mission.allowDynamicMarkets ? 'Discover & trade' : `${mission.marketCount} ${mission.marketCount === 1 ? 'market' : 'markets'}`}</strong></span></div>
        <div><Layers3 aria-hidden="true" /><span>Starting capital<strong>{formatVirtualBalance(mission.startingBalance)} virtual</strong></span></div>
        <div><Trophy aria-hidden="true" /><span>Ranked by<strong>Portfolio return</strong></span></div>
      </m.div>
    </section>
    <AnimatePresence initial={false}>
      {guideOpen && <m.section id="mission-quick-guide" className="missions-quick-guide" aria-label="How missions work" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }} transition={{ duration: reducedMotion ? 0 : TIMING.guide }}>
        <div className="missions-guide-heading"><div><p>Simple by design</p><h2>Three moves. One mission.</h2></div><Link to={href} className="focus-ring">View mission details<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
        <div className="missions-guide-steps">{guideSteps.map(step => <div key={step.number}><div className="missions-guide-step-top"><span>{step.number}</span><step.icon aria-hidden="true" /></div><h3>{step.title}</h3><p>{step.text}</p></div>)}</div>
        <button type="button" className="missions-guide-close focus-ring" onClick={() => { setGuideOpen(false); document.querySelector<HTMLButtonElement>('.missions-guide-trigger')?.focus() }}>Less detail<ArrowDown className="size-3.5" aria-hidden="true" /></button>
      </m.section>}
    </AnimatePresence>
  </div>
}

export function FeaturedMissionSkeleton() {
  return <div className="missions-experience" aria-busy="true" aria-label="Loading featured mission">
    <div className="missions-landing missions-loading-layout motion-safe:animate-pulse">
      <div className="missions-loading-copy" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="missions-loading-card" aria-hidden="true"><span /><span /><span /></div>
    </div>
  </div>
}
