import { ArrowRight, BarChart3, Crosshair, Radio, RotateCw, ShieldCheck, Swords, Trophy } from 'lucide-react'
import { HeroSculpture } from '../components/HeroSculpture'
import { Link } from 'react-router-dom'
import { MissionCard } from '../features/missions/MissionCard'
import { useMissions } from '../features/missions/useMissions'

export function HomePage() {
  return (
    <div className="pb-8">
      <section className="falcon-hero">
        <div className="falcon-hero-copy relative z-10">
          <h1 className="text-5xl font-semibold leading-[0.96] tracking-[-0.055em] text-ink xl:text-6xl">
            Trade the signal.{' '}
            <span className="text-primary">Prove the edge.</span>
          </h1>
          <p className="mt-6 text-sm leading-6 text-muted sm:text-base sm:leading-7">
            Enter time-boxed meme-coin missions with equal virtual capital. Build your strategy, execute against live market data, and earn your position on the command board.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/missions" className="directional-action focus-ring inline-flex min-h-12 items-center gap-3 rounded-sm bg-primary px-6 text-sm font-semibold text-primary-ink motion-safe:transition-colors motion-safe:duration-100 hover:bg-primary-strong active:translate-y-px">
              Enter the arena <ArrowRight className="action-icon size-4" aria-hidden="true" />
            </Link>
            <Link to="/rankings" className="focus-ring inline-flex min-h-12 items-center gap-3 rounded-sm px-5 text-sm font-semibold text-muted motion-safe:transition-colors motion-safe:duration-100 hover:text-primary">
              View rankings
            </Link>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 divide-x divide-line py-4">
            <HeroMetric label="Starting capital" value="$10K" />
            <HeroMetric label="Real assets" value="$0" />
            <HeroMetric label="Skill signal" value="100%" />
          </dl>
        </div>

        <HeroSculpture />
      </section>

      <section className="border-t border-line py-16 sm:py-20" aria-labelledby="how-it-works-title">
        <h2 id="how-it-works-title" className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">A trading arena, not a casino.</h2>
        <div className="mt-10 grid gap-10 md:mt-12 md:grid-cols-3 md:gap-8 xl:gap-16">
          <ProcessStep number="01" icon={<Swords />} title="Choose a mission" description="Review the schedule, market roster, participant field, and starting capital before you deploy." />
          <ProcessStep number="02" icon={<BarChart3 />} title="Trade the market" description="Build positions from a compact workstation with charts, buying power, exposure limits, and fill history in one view." />
          <ProcessStep number="03" icon={<ShieldCheck />} title="Lock the result" description="When the clock expires, Falcon settles every portfolio against the same final market snapshot." />
        </div>
      </section>

      <HomeMissions />

      <section className="border-y border-line py-6" aria-label="Falcon platform summary">
        <div className="grid gap-6 sm:grid-cols-3 sm:divide-x sm:divide-line">
          <PlatformStat icon={<Radio />} label="Live operations" value="Time-boxed" detail="Every mission has a defined market and finish line." />
          <PlatformStat icon={<Crosshair />} label="Execution" value="Market-aware" detail="Paper fills follow current pricing and route conditions." />
          <PlatformStat icon={<Trophy />} label="Performance" value="Verifiable" detail="Final equity determines the command board." />
        </div>
      </section>

      <section className="premium-panel relative overflow-hidden px-6 py-10 sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-12" aria-labelledby="final-cta-title">
        <div className="pointer-events-none absolute -right-12 -top-28 size-80 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <h2 id="final-cta-title" className="text-3xl font-semibold tracking-tight text-ink">Ready to put your strategy on record?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Connect a wallet to establish your participant identity. All trades use virtual capital—no deposits, no real swaps.</p>
        </div>
        <Link to="/missions" className="directional-action focus-ring relative mt-7 inline-flex min-h-12 shrink-0 items-center gap-3 rounded-md bg-primary px-6 text-sm font-semibold text-primary-ink lg:mt-0">
          Browse missions <ArrowRight className="action-icon size-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  )
}

function HomeMissions() {
  const { state, retry } = useMissions()

  const content = (() => {
    if (state.status === 'loading') {
      return <div className="grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading live missions">{[0, 1, 2].map((item) => <div key={item} className="h-80 animate-pulse rounded-lg border border-line bg-surface" />)}</div>
    }
    if (state.status === 'error') {
      return <div className="flex flex-col items-start justify-between gap-4 border border-danger/40 bg-danger/5 p-6 sm:flex-row sm:items-center" role="alert"><div><h3 className="font-semibold text-ink">Mission feed unavailable</h3><p className="mt-1 text-sm text-muted">Live operations could not be loaded.</p></div><button type="button" onClick={retry} className="focus-ring inline-flex min-h-10 items-center gap-2 border border-line px-4 text-sm text-ink hover:border-primary"><RotateCw className="size-4" aria-hidden="true" />Retry</button></div>
    }

    const featured = [...state.missions]
      .sort((left, right) => missionPriority(left.status) - missionPriority(right.status))
      .slice(0, 3)

    if (featured.length === 0) {
      return <div className="border border-dashed border-line px-6 py-10 text-center"><p className="text-sm text-muted">No missions are currently on radar.</p><Link to="/missions" className="focus-ring mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary">View mission control</Link></div>
    }

    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{featured.map((mission, index) => <MissionCard key={mission.id} mission={mission} entranceIndex={index} />)}</div>
  })()

  return (
    <section className="border-t border-line py-16 sm:py-20" aria-labelledby="live-missions-title">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><span className="mb-4 block h-0.5 w-7 bg-primary" aria-hidden="true" /><h2 id="live-missions-title" className="text-2xl font-semibold tracking-tight text-ink">Live missions</h2></div>
        <Link to="/missions" className="directional-action focus-ring inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted hover:text-primary">View all missions <ArrowRight className="action-icon size-4" aria-hidden="true" /></Link>
      </div>
      {content}
    </section>
  )
}

function missionPriority(status: string) {
  if (status === 'ACTIVE' || status === 'BLACKOUT') return 0
  if (status === 'REGISTRATION' || status === 'LOCKED' || status === 'DRAFT') return 1
  return 2
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="px-4 first:pl-0 last:pr-0"><dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:text-[10px]">{label}</dt><dd className="mt-2 font-mono text-lg tabular-nums text-ink sm:text-xl">{value}</dd></div>
}

function PlatformStat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="px-0 sm:px-6 sm:first:pl-0 sm:last:pr-0"><div className="flex items-center gap-2 text-primary [&>svg]:size-4">{icon}<span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{label}</span></div><p className="mt-3 text-xl font-semibold text-ink">{value}</p><p className="mt-2 text-sm leading-6 text-muted">{detail}</p></div>
}

function ProcessStep({ number, icon, title, description }: { number: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <article className="min-w-0">
      <div className="flex items-center justify-between border-b border-line pb-6">
        <span className="font-mono text-3xl font-normal tabular-nums tracking-tight text-primary">{number}</span>
        <span className="text-muted [&>svg]:size-5 [&>svg]:stroke-[1.5]" aria-hidden="true">{icon}</span>
      </div>
      <h3 className="mt-5 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
    </article>
  )
}
