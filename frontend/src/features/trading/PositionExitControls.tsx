import { useState } from 'react'
import { updatePositionExits } from '../../api/trading'
import { formatExitInput, parseExitPrices } from './exit-prices'
import { formatPrice } from '../../lib/format'
import type { Portfolio, Position } from '../../types/trading'

export function ExitPriceInputs({ levels, onChange, disabled = false, prefix = 'buy', placeholder = '' }: { levels: { takeProfitPrice: string; stopLossPrice: string }; onChange: (levels: { takeProfitPrice: string; stopLossPrice: string }) => void; disabled?: boolean; prefix?: string; placeholder?: string }) {
  return <div className="grid grid-cols-2 gap-3">{(['takeProfitPrice', 'stopLossPrice'] as const).map((key) => <div key={key}>
    <label htmlFor={`${prefix}-${key}`} className="text-xs text-muted">{key === 'takeProfitPrice' ? 'Take profit (USD)' : 'Stop loss (USD)'}</label>
    <input id={`${prefix}-${key}`} type="text" inputMode="decimal" autoComplete="off" value={levels[key]} onChange={(event) => onChange({ ...levels, [key]: event.target.value })} disabled={disabled} placeholder={placeholder} className="app-field focus-ring mt-2 min-h-10 w-full min-w-0 rounded-sm border border-line bg-canvas px-3 text-sm text-ink disabled:opacity-50" />
  </div>)}</div>
}

export function PositionExitControls({ missionId, position, enabled, onPortfolioUpdate, idPrefix = 'position', hideHeading = false, onSaved }: { missionId: string; position: Position; enabled: boolean; onPortfolioUpdate: (portfolio: Portfolio) => void; idPrefix?: string; hideHeading?: boolean; onSaved?: () => void }) {
  const [levels, setLevels] = useState(() => ({
    takeProfitPrice: formatExitInput(position.takeProfitPrice ?? position.currentPrice),
    stopLossPrice: formatExitInput(position.stopLossPrice ?? position.currentPrice),
  }))
  const [edited, setEdited] = useState({ takeProfitPrice: false, stopLossPrice: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(next = levels) {
    setError(null); setSaved(false)
    try {
      // A prefilled current price is a starting value, not an armed exit.
      const parsed = parseExitPrices({
        takeProfitPrice: edited.takeProfitPrice || next.takeProfitPrice !== levels.takeProfitPrice ? next.takeProfitPrice : position.takeProfitPrice ?? '',
        stopLossPrice: edited.stopLossPrice || next.stopLossPrice !== levels.stopLossPrice ? next.stopLossPrice : position.stopLossPrice ?? '',
      }, Number(position.currentPrice))
      setSaving(true)
      const { data } = await updatePositionExits(missionId, position.marketId, parsed)
      onPortfolioUpdate(data)
      setLevels(next)
      setEdited({ takeProfitPrice: false, stopLossPrice: false })
      setSaved(true)
      onSaved?.()
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Exits could not be saved.') }
    finally { setSaving(false) }
  }

  return <section className="app-surface bg-surface p-4" aria-labelledby={hideHeading ? undefined : `${idPrefix}-title`} aria-label={hideHeading ? 'Position exits' : undefined}>
    {!hideHeading && <div className="mb-4 flex items-center justify-between gap-3"><h2 id={`${idPrefix}-title`} className="text-sm font-semibold text-ink">Position exits</h2><span className="text-xs text-muted">{position.symbol}</span></div>}
    <p className="mb-4 text-xs text-muted">Entry {formatPrice(position.averageEntryPrice)} · {position.symbol}</p>
    <form onSubmit={(event) => { event.preventDefault(); void save() }}>
      <ExitPriceInputs levels={levels} onChange={(next) => { setEdited({ takeProfitPrice: edited.takeProfitPrice || next.takeProfitPrice !== levels.takeProfitPrice, stopLossPrice: edited.stopLossPrice || next.stopLossPrice !== levels.stopLossPrice }); setLevels(next); setSaved(false) }} disabled={saving || !enabled} prefix={idPrefix} />
      <div className="mt-3 flex flex-wrap gap-2">{(['takeProfitPrice', 'stopLossPrice'] as const).map((key) => position[key] !== null && <button key={key} type="button" disabled={saving || !enabled} onClick={() => void save({ ...levels, [key]: '' })} className="app-button focus-ring min-h-10 rounded-sm border border-line px-3 text-xs text-muted hover:text-ink disabled:opacity-50">Remove {key === 'takeProfitPrice' ? 'TP' : 'SL'}</button>)}</div>
      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
      {saved && <p className="mt-3 text-xs text-primary" role="status">Exits saved.</p>}
      <button type="submit" disabled={saving || !enabled} aria-busy={saving} className="app-button focus-ring mt-3 min-h-10 w-full rounded-sm border border-primary/30 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">{saving ? 'Saving…' : 'Save exits'}</button>
    </form>
    <p className="mt-3 text-xs leading-5 text-muted">Automatically sells your remaining position when a price level is reached. Final fill may vary.</p>
  </section>
}
