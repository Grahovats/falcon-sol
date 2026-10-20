import { useWallet } from '../providers/wallet-context'
import { Check, ChevronDown, Copy, ExternalLink, LogOut, ShieldCheck, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../providers/auth-context'
import { SolanaAccountIcon } from './SolanaAccountIcon'
import { resetGlassSheen, updateSurfaceSheen } from '../lib/glass-hover'
import './WalletAuthButton.css'

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
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
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
      <div ref={rootRef} className="wallet-account">
        <button
          ref={triggerRef}
          onPointerEnter={updateSurfaceSheen}
          onPointerMove={updateSurfaceSheen}
          onPointerLeave={resetGlassSheen}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Connected wallet ${address}`}
          className="app-button grain-surface wallet-grain-button wallet-account-trigger bg-primary focus-ring"
        >
          <span className="journey-sheen" aria-hidden="true" />
          <span className="wallet-account-avatar" aria-hidden="true">
            <SolanaAccountIcon address={address} size="md" />
          </span>
          <WalletAddress address={address} />
          <span className="ml-auto grid size-4 shrink-0 place-items-center" aria-hidden="true">
            <ChevronDown className={`size-4 text-primary-ink transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {open && <div role="menu" aria-label="Wallet actions" className="wallet-menu wallet-account-menu"
          onKeyDown={(event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
            const index = items.indexOf(document.activeElement as HTMLElement)
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
            items[next]?.focus()
          }}>
          <div className="wallet-account-heading">
            <SolanaAccountIcon address={address} size="md" />
            <div><p>Your wallet</p><span className="wallet-account-status">Connected to Solana</span></div>
          </div>
          <button type="button" role="menuitem" onClick={() => void copyAddress()}
            aria-label={copied ? 'Address copied' : `Copy wallet address ${address}`}
            title={copied ? 'Address copied' : `Copy ${address}`}
            className="wallet-account-copy focus-ring">
            <WalletAddress address={address} />
            {copied ? <Check className="size-4 text-primary" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          </button>
          <span className="sr-only" role="status">{copied ? 'Address copied' : ''}</span>
          <div className="wallet-account-actions">
            <a role="menuitem" href={`https://explorer.solana.com/address/${address}`} target="_blank" rel="noreferrer" className="wallet-account-action focus-ring"><ExternalLink className="size-4" aria-hidden="true" /><span>View on explorer</span></a>
            <button type="button" role="menuitem" onClick={() => void auth.signOut()} className="wallet-account-action wallet-account-signout focus-ring"><LogOut className="size-4" aria-hidden="true" /><span>Sign out</span></button>
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

/** Keep the first three characters and the longest ending that fits the row. */
function WalletAddress({ address }: { address: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [text, setText] = useState(() => `${address.slice(0, 3)}...${address.slice(-8)}`)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return
    let disposed = false
    function measure() {
      if (disposed || !element || !context || element.clientWidth === 0) return
      const style = getComputedStyle(element)
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const spacing = Number.parseFloat(style.letterSpacing) || 0
      const fits = (value: string) => context.measureText(value).width + Math.max(0, value.length - 1) * spacing <= element.clientWidth
      let next = address
      if (!fits(address)) {
        const prefix = `${address.slice(0, 3)}...`
        let low = 0
        let high = Math.max(0, address.length - 3)
        while (low < high) {
          const middle = Math.ceil((low + high) / 2)
          if (fits(prefix + address.slice(-middle))) low = middle
          else high = middle - 1
        }
        next = prefix + (low > 0 ? address.slice(-low) : '')
      }
      setText((current) => current === next ? current : next)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    const frame = window.requestAnimationFrame(measure)
    void document.fonts.ready.then(measure)
    return () => { disposed = true; observer.disconnect(); window.cancelAnimationFrame(frame) }
  }, [address])

  return <span ref={ref} className="wallet-address-fit" title={address}>{text}</span>
}
