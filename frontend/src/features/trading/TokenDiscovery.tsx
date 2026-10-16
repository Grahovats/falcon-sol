import { ArrowRight, BadgeCheck, Check, CheckCircle2, Plus, Search, ShieldAlert } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { admitToken, discoverTokens } from '../../api/trading'
import { formatCurrency, formatPercent, formatPrice } from '../../lib/format'
import { TokenIcon } from './TokenIcon'
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

  async function load(input: { query: string }, label: string) {
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
      setSuccess(`${token.symbol} added to market watch.`)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : `${token.symbol} could not be admitted.`)
    } finally {
      setBusyMint(null)
    }
  }

  return (
    <section className="token-search-content" aria-label="Find and add coins">
      <form onSubmit={search} role="search" className="token-search-form">
        <label htmlFor="token-search" className="sr-only">Token name, symbol, or mint address</label>
        <div className="token-search-field">
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <input ref={searchRef} id="token-search" type="search" autoComplete="off" spellCheck={false} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, symbol, or mint address" className="app-field app-field-embedded" />
          <button type="submit" disabled={state.status === 'loading'} aria-label="Search tokens" className="app-button focus-ring token-search-submit"><ArrowRight className="size-4" aria-hidden="true" /></button>
        </div>
      </form>
      {actionError && <p className="token-search-message text-danger" role="alert">{actionError}</p>}
      {success && <p className="token-search-message text-primary" role="status"><CheckCircle2 className="size-4" aria-hidden="true" />{success}</p>}
      {state.status === 'loading' && <div className="token-search-results" aria-busy="true" aria-label="Loading token candidates">{[0, 1, 2].map(item => <div className="token-search-skeleton motion-safe:animate-pulse" key={item}><span /><div><span /><span /></div></div>)}</div>}
      {state.status === 'error' && <div className="token-search-message" role="alert"><p className="text-danger">{state.message}</p><button type="button" onClick={() => { const normalized = query.trim(); if (normalized.length >= 2) void load({ query: normalized }, `Results for “${normalized}”`); else searchRef.current?.focus() }} className="app-button focus-ring token-search-retry">Retry</button></div>}
      {state.status === 'success' && state.tokens.length === 0 && <div className="token-search-empty"><Search className="size-5" aria-hidden="true" /><p>No matching coins</p><span>Try another name or the exact mint address.</span></div>}
      {state.status === 'success' && state.tokens.length > 0 && <div className="token-search-results">
        <div className="token-search-results-heading"><span>Search results</span><span>{state.tokens.length}</span></div>
        {state.tokens.map(token => {
          const admitted = admittedMints.has(token.mintAddress)
          const warnings = [...token.warnings, ...token.ineligibleReasons]
          return <article key={token.mintAddress} className="token-search-result">
            <div className="token-search-identity">
              <TokenIcon symbol={token.symbol} iconUrl={token.iconUrl} />
              <div className="min-w-0"><h3><span className="truncate">{token.symbol}</span>{token.isVerified && <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified token" />}</h3><p className="truncate">{token.name}</p><span className="token-search-mint" title={token.mintAddress}>{token.mintAddress.slice(0, 6)}…{token.mintAddress.slice(-6)}</span></div>
            </div>
            <dl className="token-search-stats">
              <div><dt>Price</dt><dd>{token.usdPrice === null ? '—' : formatPrice(token.usdPrice)}</dd></div>
              <div><dt>Liquidity</dt><dd>{token.liquidityUsd === null ? '—' : formatCompactUsd(token.liquidityUsd)}</dd></div>
              <div><dt>24h</dt><dd className={Number(token.priceChange24h) >= 0 ? 'text-primary' : 'text-danger'}>{token.priceChange24h === null ? '—' : formatPercent(token.priceChange24h)}</dd></div>
            </dl>
            <button type="button" disabled={admitted || !token.eligible || busyMint !== null} onClick={() => void admit(token)} aria-label={admitted ? `${token.symbol} is in market watch` : `Add ${token.symbol}`} aria-busy={busyMint === token.mintAddress} title={admitted ? 'In market watch' : !token.eligible ? warnings.join(' · ') : `Add ${token.symbol}`} className={`app-button focus-ring token-search-add ${admitted ? 'is-added' : ''}`}>
              {admitted ? <Check className="size-4" aria-hidden="true" /> : busyMint === token.mintAddress ? <span className="token-search-spinner" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            </button>
            {warnings.length > 0 && <p className={`token-search-warning ${token.eligible ? 'text-muted' : 'text-danger'}`}><ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />{warnings.slice(0, 2).join(' · ')}</p>}
          </article>
        })}
      </div>}
      <footer className="token-search-footer"><span><span className="token-search-network" />Solana</span><span><kbd>Esc</kbd> to close</span></footer>
    </section>
  )
}

function formatCompactUsd(value: number) {
  if (value < 1_000) return formatCurrency(value)
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
