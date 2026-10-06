import { LineStyle, type AutoscaleInfo, type IChartApi, type IPriceLine, type ISeriesApi } from 'lightweight-charts'
import { formatPrice } from '../../lib/format'
import type { ExitLevels, Position } from '../../types/trading'

// Native chart lines provide axis labels; accessible buttons add drag handles.
export function attachPositionLines(chart: IChartApi, series: ISeriesApi<'Candlestick'>, container: HTMLDivElement, overlay: HTMLDivElement, onError: (message: string | null) => void) {
  type Key = keyof ExitLevels
  let position: Position | undefined
  let onChange: ((levels: ExitLevels) => Promise<void>) | undefined
  let dragging: Key | null = null
  let saving = false
  let disposed = false
  let frame = 0
  let draft: ExitLevels = { takeProfitPrice: null, stopLossPrice: null }
  const lines = new Map<string, IPriceLine>()
  const handles = new Map<string, HTMLElement>()
  const colors = getComputedStyle(document.documentElement)
  const color = (name: string) => colors.getPropertyValue(name).trim()
  const price = (y: number) => {
    const value = series.coordinateToPrice(Math.max(0, Math.min(container.clientHeight, y)))
    return value === null ? null : Number(Number(value).toFixed(12))
  }

  function placeHandles() {
    frame = 0
    const values = { entry: Number(position?.averageEntryPrice ?? 0), ...draft }
    const placed: number[] = []
    for (const [key, handle] of handles) {
      const value = values[key as keyof typeof values]
      const coordinate = value === null ? null : series.priceToCoordinate(value)
      if (coordinate === null || coordinate < 0 || coordinate > container.clientHeight) { handle.hidden = true; continue }
      handle.hidden = false
      let y = Math.max(0, Math.min(container.clientHeight - 40, coordinate - 20))
      while (placed.some((other) => Math.abs(other - y) < 40) && y + 40 <= container.clientHeight - 40) y += 40
      placed.push(y)
      handle.style.top = `${y}px`
    }
  }
  function schedulePlacement() { if (!frame && !disposed) frame = requestAnimationFrame(placeHandles) }
  function preview(key: Key, value: number) {
    if (!Number.isFinite(value) || value <= 0) return
    draft[key] = value
    lines.get(key)?.applyOptions({ price: value })
    const handle = handles.get(key)
    if (handle) handle.textContent = `${key === 'takeProfitPrice' ? 'TP' : 'SL'} ${formatPrice(value)}`
    schedulePlacement()
  }
  function clear() {
    for (const line of lines.values()) series.removePriceLine(line)
    lines.clear(); handles.clear(); overlay.replaceChildren()
  }
  function draw() {
    if (disposed) return
    const focusedKey = [...handles].find(([, handle]) => handle === document.activeElement)?.[0]
    clear()
    if (!position || Number(position.quantity) <= 0) { series.applyOptions({ autoscaleInfoProvider: undefined }); return }
    draft = { takeProfitPrice: position.takeProfitPrice === null ? null : Number(position.takeProfitPrice), stopLossPrice: position.stopLossPrice === null ? null : Number(position.stopLossPrice) }
    const values = { entry: Number(position.averageEntryPrice), ...draft }
    // Include position levels in the visible price range, so off-screen exits stay discoverable.
    series.applyOptions({ autoscaleInfoProvider: (base: () => AutoscaleInfo | null) => {
      const info = base()
      if (!info?.priceRange) return info
      const levels = [Number(position?.averageEntryPrice), position?.takeProfitPrice == null ? null : Number(position.takeProfitPrice), position?.stopLossPrice == null ? null : Number(position.stopLossPrice)].filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
      return { ...info, priceRange: { minValue: Math.min(info.priceRange.minValue, ...levels), maxValue: Math.max(info.priceRange.maxValue, ...levels) } }
    } })
    for (const [key, value] of Object.entries(values)) {
      if (value === null || !Number.isFinite(value) || value <= 0) continue
      const label = key === 'entry' ? 'Entry' : key === 'takeProfitPrice' ? 'TP' : 'SL'
      const tint = key === 'entry' ? color('--color-muted') : key === 'takeProfitPrice' ? color('--color-primary') : color('--color-danger')
      lines.set(key, series.createPriceLine({ price: value, color: tint, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: label }))
      const editable = key !== 'entry' && Boolean(onChange)
      const handle = document.createElement(editable ? 'button' : 'span')
      handle.textContent = `${label} ${formatPrice(value)}`
      handle.className = `absolute left-3 flex min-h-10 items-center rounded-sm border border-line bg-surface px-3 text-xs ${editable ? 'focus-ring pointer-events-auto touch-none cursor-ns-resize' : 'pointer-events-none'}`
      handle.style.color = tint
      if (editable) {
        const button = handle as HTMLButtonElement
        const exitKey = key as Key
        button.type = 'button'
        button.title = `Drag ${label} to adjust. Arrow keys adjust; Enter saves; Escape cancels.`
        button.setAttribute('aria-label', `Adjust ${label === 'TP' ? 'take profit' : 'stop loss'} price; use arrow keys and Enter to save`)
        button.addEventListener('pointerdown', (event) => {
          if (saving || (event.pointerType === 'mouse' && event.button !== 0)) return
          event.preventDefault(); event.stopPropagation()
          button.focus(); dragging = exitKey; onError(null)
          button.setPointerCapture(event.pointerId)
        })
        button.addEventListener('pointermove', (event) => {
          if (dragging !== exitKey) return
          const next = price(event.clientY - container.getBoundingClientRect().top)
          if (next !== null) preview(exitKey, next)
        })
        button.addEventListener('pointerup', () => { if (dragging === exitKey) { dragging = null; void save() } })
        button.addEventListener('pointercancel', () => { dragging = null; draw() })
        button.addEventListener('keydown', (event) => {
          if (saving) return
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dragging = null; draw() }
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault(); onError(null)
            const current = draft[exitKey]
            if (current !== null) preview(exitKey, Number((current * (event.key === 'ArrowUp' ? 1.01 : 0.99)).toFixed(12)))
          }
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void save() }
        })
      }
      overlay.append(handle); handles.set(key, handle)
    }
    if (focusedKey) handles.get(focusedKey)?.focus()
    schedulePlacement()
  }
  async function save() {
    if (!onChange || saving) return
    saving = true
    for (const handle of handles.values()) if (handle instanceof HTMLButtonElement) handle.disabled = true
    try { await onChange({ ...draft }) }
    catch (error: unknown) { if (!disposed) onError(error instanceof Error ? error.message : 'Exit price could not be saved.') }
    finally { saving = false; draw() }
  }

  container.addEventListener('pointermove', schedulePlacement)
  container.addEventListener('pointerup', schedulePlacement)
  container.addEventListener('wheel', schedulePlacement)
  chart.timeScale().subscribeVisibleLogicalRangeChange(schedulePlacement)
  const observer = new ResizeObserver(schedulePlacement)
  observer.observe(container)
  return {
    update(next: Position | undefined, callback?: (levels: ExitLevels) => Promise<void>) {
      if (next?.takeProfitPrice !== position?.takeProfitPrice || next?.stopLossPrice !== position?.stopLossPrice) onError(null)
      position = next; onChange = callback
      if (!dragging && !saving) draw()
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect()
      container.removeEventListener('pointermove', schedulePlacement)
      container.removeEventListener('pointerup', schedulePlacement)
      container.removeEventListener('wheel', schedulePlacement)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(schedulePlacement)
      clear()
    },
  }
}
