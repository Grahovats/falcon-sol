import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Portfolio, Position } from '../../types/trading'
import { PositionExitControls } from './PositionExitControls'

export function PositionExitsModal({ missionId, position, enabled, onPortfolioUpdate, onDismiss }: { missionId: string; position: Position; enabled: boolean; onPortfolioUpdate: (portfolio: Portfolio) => void; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    dialog.querySelector<HTMLInputElement>('input')?.focus()
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }) }
  }, [])

  return <dialog ref={dialogRef} aria-labelledby="position-modal-title" onCancel={(event) => { event.preventDefault(); onDismiss() }} onClick={(event) => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onDismiss()
  }} className="app-surface app-modal token-discovery-dialog m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-lg bg-surface p-0 text-ink">
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
      <h2 id="position-modal-title" className="text-base font-semibold">TP/SL · {position.symbol}</h2>
      <button type="button" onClick={onDismiss} aria-label="Close TP/SL" className="app-button focus-ring grid size-10 shrink-0 place-items-center rounded-sm text-muted hover:bg-surface-raised hover:text-ink"><X className="size-4" aria-hidden="true" /></button>
    </div>
    <PositionExitControls missionId={missionId} position={position} enabled={enabled} onPortfolioUpdate={onPortfolioUpdate} idPrefix="position-modal" hideHeading onSaved={onDismiss} />
  </dialog>
}
