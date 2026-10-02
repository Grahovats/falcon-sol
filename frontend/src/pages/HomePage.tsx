import { ArrowRight, BarChart3, Crosshair, Radio, ShieldCheck, Swords, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'

const watchlist = [
  { symbol: 'BONK', price: '$0.00001942', change: '+8.74%', positive: true },
  { symbol: 'WIF', price: '$2.18', change: '-2.31%', positive: false },
  { symbol: 'POPCAT', price: '$0.7421', change: '+12.46%', positive: true },
  { symbol: 'PNUT', price: '$0.2147', change: '+4.18%', positive: true },
]

export function HomePage() {
  return (
    <div className="pb-8">
      <section className="grid min-h-[calc(100vh-11rem)] items-center gap-12 py-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(36rem,1.22fr)] lg:py-16">
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-5xl font-semibold leading-[0.96] tracking-[-0.055em] text-ink sm:text-6xl xl:text-7xl">
            Trade the signal.
            <span className="mt-2 block text-primary">Prove the edge.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Enter time-boxed meme-coin missions with equal virtual capital. Build your strategy, execute against live market data, and earn your position on the command board.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/missions" className="focus-ring inline-flex min-h-12 items-center gap-3 rounded-md bg-primary px-6 text-sm font-semibold text-primary-ink motion-safe:transition-colors motion-safe:duration-100 hover:bg-primary-strong active:translate-y-px">
              Enter the arena <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link to="/rankings" className="focus-ring inline-flex min-h-12 items-center gap-3 rounded-md border border-line-strong bg-surface px-6 text-sm font-semibold text-ink motion-safe:transition-colors motion-safe:duration-100 hover:border-primary/60 hover:bg-surface-raised">
              View rankings
            </Link>
          </div>
          <dl className="mt-12 grid max-w-xl grid-cols-3 divide-x divide-line border-y border-line py-5">
            <HeroMetric label="Starting capital" value="$10K" />
            <HeroMetric label="Real assets" value="$0" />
            <HeroMetric label="Skill signal" value="100%" />
          </dl>
        </div>

        <DashboardPreview />
      </section>

      <section className="border-y border-line py-6" aria-label="Falcon platform summary">
        <div className="grid gap-6 sm:grid-cols-3 sm:divide-x sm:divide-line">
          <PlatformStat icon={<Radio />} label="Live operations" value="Time-boxed" detail="Every mission has a defined market and finish line." />
          <PlatformStat icon={<Crosshair />} label="Execution" value="Market-aware" detail="Paper fills follow current pricing and route conditions." />
          <PlatformStat icon={<Trophy />} label="Performance" value="Verifiable" detail="Final equity determines the command board." />
        </div>
      </section>

      <section className="grid gap-10 py-20 lg:grid-cols-[0.7fr_1.3fr] lg:items-start" aria-labelledby="how-it-works-title">
        <div className="lg:sticky lg:top-40">
          <h2 id="how-it-works-title" className="max-w-lg text-3xl font-semibold tracking-tight text-ink sm:text-4xl">A trading arena, not a casino.</h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted">Falcon strips away bankroll advantage. Everyone starts equal; decision quality is the only thing left to measure.</p>
        </div>
        <div className="divide-y divide-line border-y border-line">
          <ProcessRow number="01" icon={<Swords />} title="Choose a mission" description="Review the schedule, market roster, operator field, and starting capital before you deploy." />
          <ProcessRow number="02" icon={<BarChart3 />} title="Trade the market" description="Build positions from a compact workstation with charts, buying power, exposure limits, and fill history in one view." />
          <ProcessRow number="03" icon={<ShieldCheck />} title="Lock the result" description="When the clock expires, Falcon settles every portfolio against the same final market snapshot." />
        </div>
      </section>

      <section className="premium-panel relative overflow-hidden px-6 py-10 sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-12" aria-labelledby="final-cta-title">
        <div className="pointer-events-none absolute -right-12 -top-28 size-80 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <h2 id="final-cta-title" className="text-3xl font-semibold tracking-tight text-ink">Ready to put your strategy on record?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Connect a wallet to establish your operator identity. All trades use virtual capital—no deposits, no real swaps.</p>
        </div>
        <Link to="/missions" className="focus-ring relative mt-7 inline-flex min-h-12 shrink-0 items-center gap-3 rounded-md bg-primary px-6 text-sm font-semibold text-primary-ink lg:mt-0">
          Browse missions <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  )
}

function DashboardPreview() {
  return (
    <div className="premium-panel relative min-w-0 overflow-hidden p-2 shadow-2xl shadow-black/30">
      <div className="grid min-h-[31rem] grid-cols-[7rem_minmax(0,1fr)] sm:grid-cols-[9rem_minmax(0,1fr)_10rem]">
        <aside className="border-r border-line p-3" aria-label="Preview watchlist">
          <h3 className="px-2 text-[10px] font-semibold text-muted">Market watch</h3>
          <div className="mt-3 space-y-1">
            {watchlist.map((market, index) => (
              <div key={market.symbol} className={`rounded-md border px-2 py-3 ${index === 0 ? 'border-primary/35 bg-primary/5' : 'border-transparent'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink">{market.symbol}</span>
                  <span className={`font-mono text-[9px] ${market.positive ? 'text-primary' : 'text-danger'}`}>{market.change}</span>
                </div>
                <p className="mt-1 truncate font-mono text-[9px] text-muted">{market.price}</p>
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-ink">BONK <span className="font-mono text-[10px] font-normal text-muted">/ vUSDC</span></p>
              <div className="mt-1 flex items-baseline gap-2"><span className="font-mono text-xl tabular-nums text-ink">$0.00001942</span><span className="font-mono text-[10px] text-primary">+8.74%</span></div>
            </div>
            <div className="text-right"><p className="font-mono text-[9px] uppercase tracking-wider text-muted">Mission ends</p><p className="mt-1 font-mono text-xs text-ink">04:28:16</p></div>
          </div>
          <div className="chart-grid relative h-64 overflow-hidden border-b border-line" aria-hidden="true">
            <svg className="absolute inset-0 h-full w-full text-primary" viewBox="0 0 600 260" preserveAspectRatio="none">
              <defs><linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.24" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
              <path d="M0 210 C35 196,55 218,82 185 S128 153,152 170 S196 126,226 140 S276 118,306 132 S358 88,388 102 S430 58,462 74 S515 38,600 42 L600 260 L0 260 Z" fill="url(#chart-area)" />
              <path d="M0 210 C35 196,55 218,82 185 S128 153,152 170 S196 126,226 140 S276 118,306 132 S358 88,388 102 S430 58,462 74 S515 38,600 42" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="absolute right-3 top-9 rounded-sm bg-primary px-2 py-1 font-mono text-[9px] text-primary-ink">0.00001942</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-line px-4 py-4">
            <PreviewMetric label="Equity" value="$10,842.17" />
            <PreviewMetric label="Return" value="+8.42%" positive />
            <PreviewMetric label="Rank" value="#07" />
          </div>
        </div>

        <aside className="hidden border-l border-line p-3 sm:block" aria-label="Preview command board">
          <h3 className="text-[10px] font-semibold text-muted">Command board</h3>
          <ol className="mt-3 space-y-1">
            {['NOVA', '0xMILO', 'KITE', 'VESPER', 'FALCON'].map((name, index) => (
              <li key={name} className={`flex items-center gap-2 rounded-md px-2 py-2 ${name === 'FALCON' ? 'bg-primary/5' : ''}`}>
                <span className="font-mono text-[9px] text-muted">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-ink">{name}</span>
                <span className="font-mono text-[9px] text-primary">+{(14.8 - index * 1.42).toFixed(1)}%</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-md border border-line bg-canvas p-3">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted">Buying power</p>
            <p className="mt-2 font-mono text-xs text-ink">$4,120.00</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="px-4 first:pl-0 last:pr-0"><dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:text-[10px]">{label}</dt><dd className="mt-2 font-mono text-lg tabular-nums text-ink sm:text-xl">{value}</dd></div>
}

function PlatformStat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="px-0 sm:px-6 sm:first:pl-0 sm:last:pr-0"><div className="flex items-center gap-2 text-primary [&>svg]:size-4">{icon}<span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{label}</span></div><p className="mt-3 text-xl font-semibold text-ink">{value}</p><p className="mt-2 text-sm leading-6 text-muted">{detail}</p></div>
}

function ProcessRow({ number, icon, title, description }: { number: string; icon: React.ReactNode; title: string; description: string }) {
  return <article className="group grid gap-4 py-7 sm:grid-cols-[3rem_2.5rem_minmax(0,1fr)] sm:items-start"><span className="font-mono text-xs text-muted">{number}</span><span className="grid size-10 place-items-center rounded-md border border-line bg-surface text-primary motion-safe:transition-colors motion-safe:duration-100 group-hover:border-primary/40 group-hover:bg-primary/5 [&>svg]:size-4">{icon}</span><div><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p></div></article>
}

function PreviewMetric({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return <div className="px-3 first:pl-0 last:pr-0"><p className="font-mono text-[8px] uppercase tracking-wider text-muted">{label}</p><p className={`mt-1 font-mono text-[10px] tabular-nums ${positive ? 'text-primary' : 'text-ink'}`}>{value}</p></div>
}
