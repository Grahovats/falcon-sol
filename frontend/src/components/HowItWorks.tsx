import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ArrowRight, BarChart3, ShieldCheck, Swords, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProcessSignalField } from './ProcessSignalField'
import { SectionSignalField } from './SectionSignalField'

const steps = [
  { number: '01', label: 'Choose your mission', title: 'Find your arena.', description: 'Pick a mission that fits your strategy. Review the assets, rules, and time window before you enter.', icon: Swords, href: '/missions', action: 'Explore missions' },
  { number: '02', label: 'Deploy virtual capital', title: 'Same start. Your edge.', description: 'Enter with the same virtual starting balance as every operator. No deposits or real swaps—just your decisions.', icon: Wallet, href: null, action: null },
  { number: '03', label: 'Execute your strategy', title: 'Make every move count.', description: 'Read live charts, size your positions, and set take-profit and stop-loss exits. Trade with a plan until the clock runs out.', icon: BarChart3, href: null, action: null },
  { number: '04', label: 'See your standing', title: 'Let the result speak.', description: 'The mission closes on a shared price snapshot. Your final equity locks in your rank and a record you can compare.', icon: ShieldCheck, href: '/rankings', action: 'View rankings' },
] as const

/* Reveal storyboard (relative to each card entering the viewport):
 *   0ms  queue the card; already revealed cards stay visible
 * 180ms  reveal the next card if several enter together
 * 700ms  its incoming connector finishes drawing
 */
const REVEAL_TIMING = { staggerMs: 180 } as const

function updateGlassSheen(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const card = event.currentTarget
  // Measure the untransformed wrapper so the tilt never feeds back into itself.
  const bounds = card.parentElement!.getBoundingClientRect()
  const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1))
  const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1))
  card.style.setProperty('--tilt-x', `${-y * 4}deg`)
  card.style.setProperty('--tilt-y', `${x * 5}deg`)
  card.style.setProperty('--sheen-angle', `${125 + x * 18 - y * 10}deg`)
  card.style.setProperty('--sheen-position', `${50 + x * 14 + y * 10}%`)
}

function resetGlassSheen(event: PointerEvent<HTMLDivElement>) {
  const card = event.currentTarget
  card.style.setProperty('--tilt-x', '0deg')
  card.style.setProperty('--tilt-y', '0deg')
  card.style.setProperty('--sheen-angle', '125deg')
  card.style.setProperty('--sheen-position', '50%')
}

export function HowItWorks() {
  const stepsRef = useRef<HTMLDivElement>(null)
  const initialStage = () => typeof window !== 'undefined' && (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) ? steps.length : 0
  const [requested, setRequested] = useState(initialStage)
  const [stage, setStage] = useState(initialStage)

  useEffect(() => {
    const parent = stepsRef.current
    if (!parent) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const showAll = () => {
      if (preference.matches) setRequested(steps.length)
    }
    preference.addEventListener('change', showAll)
    let observer: IntersectionObserver | undefined
    if (!preference.matches && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const index = Number((entry.target as HTMLElement).dataset.processStep)
          setRequested((current) => Math.max(current, index))
          observer?.unobserve(entry.target)
        })
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
      parent.querySelectorAll('[data-process-step]').forEach((card) => observer?.observe(card))
    }
    return () => { observer?.disconnect(); preference.removeEventListener('change', showAll) }
  }, [])

  useEffect(() => {
    if (stage >= requested) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setStage((current) => reduceMotion ? requested : current + 1), stage === 0 || reduceMotion ? 0 : REVEAL_TIMING.staggerMs)
    return () => window.clearTimeout(timer)
  }, [requested, stage])

  return <section className="journey-section py-16 sm:py-20" aria-labelledby="how-it-works-title">
    <div className="journey-background" aria-hidden="true">
      <SectionSignalField side="right" wide />
      <SectionSignalField side="left" />
    </div>
    <div className="journey-intro">
      <div>
        <p className="mb-4 flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-muted"><span className="h-px w-6 bg-primary" aria-hidden="true" />How Falcon works</p>
        <h2 id="how-it-works-title" className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">From first trade<br />to final rank.</h2>
      </div>
      <p className="max-w-sm text-sm leading-7 text-muted">One mission. Equal starting capital.<br />A clear record of the decisions you make.</p>
    </div>

    <div ref={stepsRef} className="journey-steps relative mt-12 sm:mt-16">
      <ProcessSignalField revealedSteps={stage} />
      {steps.map(({ number, label, title, description, icon: Icon, href, action }) => <article key={number} className={`journey-step${stage >= Number(number) ? ' journey-step-visible' : ''}`} data-process-step={number}>
        <span className="journey-node journey-node-mobile" data-process-node aria-hidden="true"><Icon className="size-3.5" strokeWidth={1.5} /></span>
        <div className="journey-copy" onPointerEnter={updateGlassSheen} onPointerMove={updateGlassSheen} onPointerLeave={resetGlassSheen}>
          <span className="journey-sheen" aria-hidden="true" />
          <span className="journey-node journey-node-desktop" data-process-node aria-hidden="true"><Icon className="size-3.5" strokeWidth={1.5} /></span>
          <p className="journey-eyebrow"><span className="journey-number">{number}</span><span>{label}</span></p>
          <h3 className="mt-5 text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">{title}</h3>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted">{description}</p>
          {href && <Link to={href} className="focus-ring mt-4 inline-flex min-h-10 items-center gap-2 rounded-sm text-sm font-medium text-ink hover:text-primary">{action}<ArrowRight className="size-4" aria-hidden="true" /></Link>}
        </div>
      </article>)}
    </div>
  </section>
}
