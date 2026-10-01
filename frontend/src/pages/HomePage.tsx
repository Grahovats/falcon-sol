import { ArrowRight, ShieldCheck, Swords } from 'lucide-react'
import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="py-8 sm:py-16">
      <div className="max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Competitive paper trading · Solana</p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-6xl lg:text-7xl">Markets are the field.<br /><span className="text-primary">Performance decides.</span></h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg">Deploy into time-boxed trading missions with equal virtual capital. Test your read of the market, then take your place on the command board.</p>
        <Link to="/missions" className="focus-ring mt-8 inline-flex min-h-11 items-center gap-3 rounded-sm bg-primary px-5 text-sm font-semibold text-primary-ink hover:bg-primary-strong">View active missions <ArrowRight className="size-4" aria-hidden="true" /></Link>
      </div>
      <div className="mt-16 grid border-y border-line sm:grid-cols-2">
        <div className="border-b border-line py-7 sm:border-r sm:border-b-0 sm:pr-8"><Swords className="size-5 text-primary" aria-hidden="true" /><h2 className="mt-4 font-semibold text-ink">Equal starting position</h2><p className="mt-2 text-sm leading-6 text-muted">Every operator receives the same virtual balance and trades the same selected markets.</p></div>
        <div className="py-7 sm:pl-8"><ShieldCheck className="size-5 text-primary" aria-hidden="true" /><h2 className="mt-4 font-semibold text-ink">No real swaps</h2><p className="mt-2 text-sm leading-6 text-muted">This MVP is a free paper-trading competition. Wallet and payout systems are not active.</p></div>
      </div>
    </div>
  )
}
