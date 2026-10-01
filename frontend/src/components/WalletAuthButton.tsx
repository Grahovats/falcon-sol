import { useWallet } from '../providers/wallet-context'
import { Check, Copy, ExternalLink, LogOut, ShieldCheck, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../providers/auth-context'

export function WalletAuthButton() {
  const { account, connecting, setModalOpen } = useWallet()
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const address = auth.user?.wallet ?? account?.address ?? null
  const authenticated = auth.status === 'authenticated' && auth.user !== null

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
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
    return <div className="h-11 w-36 animate-pulse border border-line bg-surface" aria-label="Checking wallet session" />
  }

  if (authenticated && address) {
    return (
      <div ref={rootRef} className="relative">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" className="focus-ring flex min-h-11 items-center gap-2 border border-primary/40 bg-primary/5 px-4 font-mono text-xs uppercase tracking-wider text-ink hover:border-primary">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />{truncateAddress(address)}
        </button>
        {open && <div role="menu" className="absolute right-0 z-50 mt-2 w-56 border border-line bg-surface p-1 shadow-2xl shadow-black/40">
          <div className="border-b border-line px-3 py-2"><p className="text-xs uppercase tracking-wider text-muted">Authenticated operator</p><p className="mt-1 truncate font-mono text-xs text-ink" title={address}>{address}</p></div>
          <button type="button" role="menuitem" onClick={() => void copyAddress()} className="focus-ring flex min-h-10 w-full items-center gap-3 px-3 text-left text-sm text-ink hover:bg-primary/5">{copied ? <Check className="size-4 text-primary" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}{copied ? 'Copied' : 'Copy address'}</button>
          <a role="menuitem" href={`https://explorer.solana.com/address/${address}`} target="_blank" rel="noreferrer" className="focus-ring flex min-h-10 items-center gap-3 px-3 text-sm text-ink hover:bg-primary/5"><ExternalLink className="size-4" aria-hidden="true" />View on explorer</a>
          <button type="button" role="menuitem" onClick={() => void auth.signOut()} className="focus-ring flex min-h-10 w-full items-center gap-3 border-t border-line px-3 text-left text-sm text-danger hover:bg-danger/5"><LogOut className="size-4" aria-hidden="true" />Sign out</button>
        </div>}
      </div>
    )
  }

  if (account) {
    return <div className="flex flex-col items-end gap-1"><button type="button" disabled={auth.status === 'signing'} aria-busy={auth.status === 'signing'} onClick={() => void auth.signIn().catch(() => undefined)} className="focus-ring flex min-h-11 items-center gap-2 border border-primary bg-primary px-4 font-mono text-xs font-semibold uppercase tracking-wider text-primary-ink disabled:cursor-wait disabled:opacity-70"><ShieldCheck className="size-4" aria-hidden="true" />{auth.status === 'signing' ? 'Approve signature…' : 'Sign in'}</button>{auth.error && <span className="max-w-64 text-right text-xs text-danger" role="alert">{auth.error}</span>}</div>
  }

  return <button type="button" disabled={connecting} aria-busy={connecting} onClick={() => setModalOpen(true)} className="focus-ring flex min-h-11 items-center gap-2 border border-line bg-surface px-4 font-mono text-xs uppercase tracking-wider text-ink hover:border-primary disabled:cursor-wait disabled:text-muted"><Wallet className="size-4" aria-hidden="true" />{connecting ? 'Connecting…' : 'Connect Wallet'}</button>
}

function truncateAddress(address: string) { return `${address.slice(0, 4)}...${address.slice(-4)}` }
