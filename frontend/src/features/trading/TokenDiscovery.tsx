import { CheckCircle2, Radar, Search, ShieldAlert } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { admitToken, discoverTokens } from '../../api/trading'
import { formatCurrency, formatPercent, formatPrice } from '../../lib/format'
import type { TokenCandidate } from '../../types/trading'

type DiscoveryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; tokens: TokenCandidate[]; label: string }
  | { status: 'error'; message: string }

export function TokenDiscovery({ missionId, admittedMints, onAdmitted }: { missionId: string; admittedMints: Set<string>; onAdmitted: (marketId: string) => Promise<void> }) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    searchRef.current?.focus()
    return () => requestRef.current?.abort()
  }, [])
  const [state, setState] = useState<DiscoveryState>({ status: 'idle' })
  const [busyMint, setBusyMint] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load(input: { query: string } | { feed: 'recent' }, label: string) {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setState({ status: 'loading' })
    setActionError(null)
    setSuccess(null)
    try {
      const response = await discoverTokens(missionId, input, controller.signal)
      if (!controller.signal.aborted) setState({ status: 'success', tokens: response.data, label })
    } catch (error: unknown) {
      if (controller.signal.aborted) return
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Token discovery could not load.' })
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = query.trim()
    if (normalized.length < 2) {
      setState({ status: 'error', message: 'Enter at least two characters or paste a full mint address.' })
      return
    }
    void load({ query: normalized }, `Results for “${normalized}”`)
  }

  async function admit(token: TokenCandidate) {
    setBusyMint(token.mintAddress)
    setActionError(null)
    setSuccess(null)
    try {
      const response = await admitToken(missionId, token.mintAddress)
      await onAdmitted(response.data.market.id)
      setSuccess(`${token.symbol} passed Falcon’s two-way route check and is ready to paper-trade.`)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : `${token.symbol} could not be admitted.`)
    } finally {
      setBusyMint(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line-strong bg-surface" aria-labelledby="token-radar-title">
      <div className="grid gap-4 border-b border-line px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,34rem)] lg:items-end lg:px-5 lg:pr-16">
        <div>
          <h2 id="token-radar-title" className="flex items-center gap-2 pr-12 text-lg font-semibold text-ink"><Radar className="size-4 text-primary" aria-hidden="true" />Find your next coin</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Search Solana meme coins by name, symbol, or mint address. Browse new launches and add eligible coins to your market watch.</p>
        </div>
        <form onSubmit={search} role="search">
          <label htmlFor="token-search" className="mb-2 block text-xs uppercase tracking-wider text-muted">Name, symbol, or mint</label>
          <div className="flex flex-wrap gap-2">
            <div className="flex min-h-11 min-w-0 basis-full items-center rounded-lg border border-line bg-canvas sm:basis-auto sm:flex-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40">
              <Search className="ml-3 size-4 shrink-0 text-muted" aria-hidden="true" />
              <input ref={searchRef} id="token-search" type="search" autoComplete="off" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-ink focus:outline-none" placeholder="BONK or mint address" />
            </div>
            <button type="submit" disabled={state.status === 'loading'} className="focus-ring min-h-11 rounded-lg border border-primary bg-primary/10 px-4 text-sm font-semibold text-primary disabled:cursor-wait disabled:opacity-50">Search</button>
            <button type="button" disabled={state.status === 'loading'} onClick={() => void load({ feed: 'recent' }, 'Recent launches')} className="focus-ring min-h-11 rounded-lg border border-line px-4 text-sm text-ink hover:border-primary disabled:cursor-wait disabled:opacity-50">New coins</button>
          </div>
        </form>
      </div>

      {actionError && <div className="border-b border-danger/40 bg-danger/5 px-5 py-3 text-sm text-danger" role="alert">{actionError}</div>}
      {success && <div className="flex items-center gap-2 border-b border-primary/30 bg-primary/5 px-5 py-3 text-sm text-ink" role="status"><CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />{success}</div>}
      {state.status === 'idle' && <div className="px-5 py-5 text-sm text-muted">Search for a token, or select New coins to explore recent launches.</div>}
      {state.status === 'loading' && <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading token candidates">{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse bg-canvas/70" />)}</div>}
      {state.status === 'error' && <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5" role="alert"><p className="text-sm text-danger">{state.message}</p><button type="button" onClick={() => void load({ feed: 'recent' }, 'Recent launches')} className="focus-ring min-h-10 border border-line px-3 text-sm text-ink hover:border-primary">Try recent launches</button></div>}
      {state.status === 'success' && state.tokens.length === 0 && <div className="px-5 py-5"><p className="text-sm font-medium text-ink">No matching tokens</p><p className="mt-1 text-sm text-muted">Check the spelling or paste the exact Solana mint address.</p></div>}
      {state.status === 'success' && state.tokens.length > 0 && <div><p className="border-b border-line px-5 py-3 text-sm font-medium text-ink">{state.label} · {state.tokens.length}</p><div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">{state.tokens.map((token) => {
        const admitted = admittedMints.has(token.mintAddress)
        const warnings = [...token.warnings, ...token.ineligibleReasons]
        return <article key={token.mintAddress} className="flex min-h-44 flex-col bg-surface p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold text-ink">{token.symbol} <span className="font-normal text-muted">{token.name}</span></h3><p className="mt-1 truncate font-mono text-xs text-muted" title={token.mintAddress}>{token.mintAddress.slice(0, 6)}…{token.mintAddress.slice(-6)}</p></div>{token.isVerified && <span className="shrink-0 border border-primary/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">Verified</span>}</div><dl className="mt-4 grid grid-cols-3 gap-3 text-xs"><div><dt className="text-muted">Price</dt><dd className="mt-1 font-mono text-ink">{token.usdPrice === null ? '—' : formatPrice(token.usdPrice)}</dd></div><div><dt className="text-muted">Liquidity</dt><dd className="mt-1 font-mono text-ink">{token.liquidityUsd === null ? '—' : formatCompactUsd(token.liquidityUsd)}</dd></div><div><dt className="text-muted">24h move</dt><dd className={`mt-1 font-mono ${Number(token.priceChange24h) >= 0 ? 'text-primary' : 'text-danger'}`}>{token.priceChange24h === null ? '—' : formatPercent(token.priceChange24h)}</dd></div></dl>{warnings.length > 0 && <p className={`mt-3 flex gap-2 text-xs leading-5 ${token.eligible ? 'text-muted' : 'text-danger'}`}><ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{warnings.slice(0, 2).join(' · ')}</p>}<button type="button" disabled={admitted || !token.eligible || busyMint !== null} onClick={() => void admit(token)} aria-busy={busyMint === token.mintAddress} className="focus-ring mt-auto min-h-10 border border-line px-3 text-sm font-semibold text-ink hover:border-primary disabled:cursor-not-allowed disabled:text-muted">{admitted ? 'In arena' : busyMint === token.mintAddress ? 'Checking routes…' : token.eligible ? 'Add coin' : 'Not eligible'}</button></article>
      })}</div></div>}
    </section>
  )
}

function formatCompactUsd(value: number) {
  if (value < 1_000) return formatCurrency(value)
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
