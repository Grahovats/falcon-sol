import { ShieldCheck } from 'lucide-react'
import { WalletAuthButton } from './WalletAuthButton'

export function AuthenticationRequired({ title = 'Authenticate your participant' }: { title?: string }) {
  return (
    <section className="mx-auto max-w-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="auth-required-title">
      <div className="flex size-11 items-center justify-center border border-primary/30 bg-primary/5 text-primary"><ShieldCheck className="size-5" aria-hidden="true" /></div>
      <h1 id="auth-required-title" className="mt-5 text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Connect your Solana wallet, then approve a message signature. The signature creates your Falcon session and cannot move funds or submit a transaction.</p>
      <div className="mt-6"><WalletAuthButton /></div>
    </section>
  )
}
