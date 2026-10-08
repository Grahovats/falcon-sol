import { useWallet } from '../providers/wallet-context'
import { Check, ChevronDown, Copy, ExternalLink, LogOut, ShieldCheck, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../providers/auth-context'
import { SolanaAccountIcon } from './SolanaAccountIcon'
import { resetGlassSheen, updateSurfaceSheen } from '../lib/glass-hover'

export function WalletAuthButton() {
  const { account, connecting, setModalOpen } = useWallet()
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const address = auth.user?.wallet ?? account?.address ?? null
  const authenticated = auth.status === 'authenticated' && auth.user !== null

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [open])

  async function copyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }

  if (auth.status === 'loading') {
    return <div className="app-surface h-10 w-36 animate-pulse border border-line bg-surface" aria-label="Checking wallet session" />
  }

  if (authenticated && address) {
    return (
      <div ref={rootRef} className="relative">
        <button
          ref={triggerRef}
          onPointerEnter={updateSurfaceSheen}
          onPointerMove={updateSurfaceSheen}
          onPointerLeave={resetGlassSheen}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Connected wallet ${truncateAddress(address)}`}
          className="app-button grain-surface wallet-grain-button focus-ring group flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl rounded-tr-sm border border-primary-strong bg-primary p-1 pl-2 text-left text-primary-ink shadow-sm shadow-primary/20 hover:bg-primary-strong"
        >
          <span className="journey-sheen" aria-hidden="true" />
          <span className="relative grid size-7 place-items-center rounded-lg bg-primary-ink/90 ring-1 ring-primary-ink/20" aria-hidden="true">
            <SolanaAccountIcon address={address} size="sm" />
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-primary bg-primary-ink group-hover:border-primary-strong" />
          </span>
          <span className="hidden font-mono text-xs font-semibold leading-none tracking-tight text-primary-ink sm:block">{truncateAddress(address)}</span>
          <span className="font-mono text-xs font-semibold tracking-tight text-primary-ink sm:hidden">{truncateAddress(address)}</span>
          <span className="ml-0.5 grid size-7 place-items-center rounded-lg rounded-tr-sm bg-primary-ink/10" aria-hidden="true">
            <ChevronDown className={`size-4 text-primary-ink transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {open && <div role="menu" aria-label="Wallet actions" className="app-surface wallet-menu absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/40">
          <div className="rounded-lg bg-primary px-3 py-3 text-primary-ink">
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em]">Solana account</p><span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"><span className="size-1.5 rounded-full bg-primary-ink" aria-hidden="true" />Active</span></div>
            <p className="mt-2 break-all font-mono text-xs font-medium leading-5" title={address}>{address}</p>
          </div>
          <div className="mt-1 grid gap-0.5">
            <button type="button" role="menuitem" onClick={() => void copyAddress()} className="app-button focus-ring flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-ink hover:bg-surface-raised">{copied ? <Check className="size-4 text-primary" aria-hidden="true" /> : <Copy className="size-4 text-muted" aria-hidden="true" />}<span className="flex-1">{copied ? 'Address copied' : 'Copy address'}</span>{copied && <span className="text-xs text-primary" aria-live="polite">Copied</span>}</button>
            <a role="menuitem" href={`https://explorer.solana.com/address/${address}`} target="_blank" rel="noreferrer" className="app-button focus-ring flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink hover:bg-surface-raised"><ExternalLink className="size-4 text-muted" aria-hidden="true" />View on explorer</a>
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <button type="button" role="menuitem" onClick={() => void auth.signOut()} className="app-button focus-ring flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-danger hover:bg-danger/5"><LogOut className="size-4" aria-hidden="true" />Sign out</button>
          </div>
        </div>}
      </div>
    )
  }

  if (account) {
    return <div className="flex flex-col items-end gap-1"><button onPointerEnter={updateSurfaceSheen} onPointerMove={updateSurfaceSheen} onPointerLeave={resetGlassSheen} type="button" disabled={auth.status === 'signing'} aria-busy={auth.status === 'signing'} onClick={() => void auth.signIn().catch(() => undefined)} className="app-button grain-surface wallet-grain-button focus-ring flex min-h-10 items-center gap-2 border border-primary bg-primary px-4 font-mono text-xs font-semibold uppercase tracking-wider text-primary-ink disabled:cursor-wait disabled:opacity-70"><span className="journey-sheen" aria-hidden="true" /><ShieldCheck className="size-4" aria-hidden="true" />{auth.status === 'signing' ? 'Approve signature…' : 'Sign in'}</button>{auth.error && <span className="max-w-64 text-right text-xs text-danger" role="alert">{auth.error}</span>}</div>
  }

  return <button onPointerEnter={updateSurfaceSheen} onPointerMove={updateSurfaceSheen} onPointerLeave={resetGlassSheen} type="button" disabled={connecting} aria-busy={connecting} onClick={() => setModalOpen(true)} className="app-button grain-surface wallet-grain-button focus-ring flex min-h-10 items-center gap-2 border border-line bg-surface px-4 font-mono text-xs uppercase tracking-wider text-ink hover:border-primary disabled:cursor-wait disabled:text-muted"><span className="journey-sheen" aria-hidden="true" /><Wallet className="size-4" aria-hidden="true" />{connecting ? 'Connecting…' : 'Connect Wallet'}</button>
}

function truncateAddress(address: string) { return `${address.slice(0, 4)}...${address.slice(-4)}` }
