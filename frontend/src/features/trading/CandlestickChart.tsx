import { LoaderCircle, RotateCw } from 'lucide-react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type Time,
  type IRange,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getCandles } from '../../api/trading'
import { ApiError } from '../../api/client'
import { useClock } from '../../hooks/useClock'
import { formatPrice } from '../../lib/format'
import type { CandleTimeframe, ExitLevels, MarketCandle, Position } from '../../types/trading'

import { attachPositionLines } from './position-chart-lines'
import { ChartLoading } from './ChartLoading'

const timeframes: CandleTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']
type CandleState =
  | { status: 'loading' }
  | { status: 'success'; candles: MarketCandle[]; stale: boolean; fetchedAt: number }
  | { status: 'error'; message: string }

interface CandlestickChartProps {
  missionId: string
  marketId: string
  symbol: string
  position?: Position
  onExitChange?: (levels: ExitLevels) => Promise<void>
}

export function CandlestickChart(props: CandlestickChartProps) {
  return <CandleChart key={`${props.missionId}:${props.marketId}`} {...props} />
}

function CandleChart({ missionId, marketId, symbol, position, onExitChange }: CandlestickChartProps) {
  const [timeframe, setTimeframe] = useState<CandleTimeframe>('5m')
  const [state, setState] = useState<CandleState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [historyEnded, setHistoryEnded] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const olderRequest = useRef<AbortController | null>(null)
  const [retryAt, setRetryAt] = useState(0)
  const [historyRetryAt, setHistoryRetryAt] = useState(0)
  const autoRetries = useRef(0)
  const now = useClock()
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000))
  const historyRetrySeconds = Math.max(0, Math.ceil((historyRetryAt - now) / 1000))

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => { void getCandles(missionId, marketId, timeframe, controller.signal)
      .then(({ data, meta }) => { if (!controller.signal.aborted) { autoRetries.current = 0; setRetryAt(0); setState(data.length ? { status: 'success', candles: data, stale: meta.stale, fetchedAt: meta.fetchedAt } : { status: 'error', message: 'No candles are available for this market yet.' }) } })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && [0, 429, 502, 503, 504].includes(error.status) && autoRetries.current < 2) {
          setRetryAt(Date.now() + (error.retryAfterSeconds ?? (error.status === 429 ? 60 : 5 * (autoRetries.current + 1))) * 1000)
        }
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Candle history could not be loaded.' })
      }) }, 250)
    return () => { window.clearTimeout(timer); controller.abort(); olderRequest.current?.abort(); olderRequest.current = null }
  }, [marketId, missionId, reloadKey, timeframe])

  useEffect(() => {
    if (!retryAt || autoRetries.current >= 2) return
    const timer = window.setTimeout(() => {
      autoRetries.current += 1
      setState({ status: 'loading' })
      setReloadKey(value => value + 1)
    }, Math.max(0, retryAt - Date.now()) + 250)
    return () => window.clearTimeout(timer)
  }, [retryAt])

  async function loadOlder() {
    if (state.status !== 'success' || olderRequest.current || historyEnded || historyRetrySeconds) return
    const before = state.candles[0].time
    const controller = new AbortController()
    olderRequest.current = controller
    setLoadingOlder(true)
    setHistoryError(null)
    try {
      const { data } = await getCandles(missionId, marketId, timeframe, controller.signal, before)
      if (controller.signal.aborted) return
      const older = data.filter(candle => candle.time < before)
      if (!older.length) setHistoryEnded(true)
      else setState(current => current.status === 'success' ? {
        ...current,
        status: 'success',
        candles: [...new Map([...older, ...current.candles].map(candle => [candle.time, candle])).values()].sort((a, b) => a.time - b.time),
      } : current)
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof ApiError && error.status === 429) setHistoryRetryAt(Date.now() + (error.retryAfterSeconds ?? 60) * 1000)
        setHistoryError(error instanceof Error ? error.message : 'Older history could not be loaded. Try again.')
      }
    } finally {
      if (olderRequest.current === controller) { olderRequest.current = null; setLoadingOlder(false) }
    }
  }

  return (
    <div className="terminal-candlestick border-t border-line bg-canvas/40">
      <div className="terminal-chart-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Chart timeframe">
          {timeframes.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={timeframe === value}
              onClick={() => { if (value !== timeframe) { olderRequest.current?.abort(); olderRequest.current = null; autoRetries.current = 0; setRetryAt(0); setHistoryRetryAt(0); setLoadingOlder(false); setHistoryEnded(false); setHistoryError(null); setState({ status: 'loading' }); setTimeframe(value) } }}
              className={`app-button focus-ring min-h-10 min-w-11 px-3 font-mono text-xs transition-colors ${timeframe === value ? 'bg-surface-raised text-primary' : 'text-muted hover:bg-surface hover:text-ink'}`}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted">USD</p>
      </div>

      {state.status === 'loading' && <ChartLoading symbol={symbol} />}
      {state.status === 'error' && retrySeconds > 0 && <ChartLoading symbol={symbol} detail={`Waiting for chart data · Retry in ${retrySeconds}s`} />}
      {state.status === 'error' && retrySeconds === 0 && (
        <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
          <p className="text-sm font-medium text-ink">{retrySeconds ? 'Waiting for chart data' : 'Chart unavailable'}</p>
          <p className="max-w-md text-sm text-muted">{state.message}</p>
          <button type="button" disabled={retrySeconds > 0} onClick={() => { autoRetries.current = 0; setRetryAt(0); setState({ status: 'loading' }); setReloadKey((value) => value + 1) }} className="app-button focus-ring inline-flex min-h-10 items-center gap-2 border border-line px-4 text-sm text-ink hover:border-primary disabled:opacity-50">
            <RotateCw className="size-4" aria-hidden="true" /> {retrySeconds ? `Retry in ${retrySeconds}s` : 'Retry chart'}
          </button>
        </div>
      )}
      {state.status === 'success' && state.stale && <p className="border-b border-line px-4 py-2 text-xs text-muted" role="status">Showing saved chart data from {new Date(state.fetchedAt).toLocaleTimeString()}. New candles are temporarily unavailable.</p>}
      {state.status === 'success' && <ChartCanvas key={`${marketId}:${timeframe}`} candles={state.candles} symbol={symbol} timeframe={timeframe} position={position} onExitChange={onExitChange} />}
      {state.status === 'success' && <div className="terminal-history-controls flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2">
        <button type="button" aria-busy={loadingOlder} disabled={loadingOlder || historyEnded || historyRetrySeconds > 0} onClick={() => void loadOlder()} className="app-button focus-ring inline-flex min-h-10 items-center gap-2 border border-line px-3 text-xs text-ink hover:border-primary disabled:cursor-default disabled:opacity-50">
          {loadingOlder && <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />}
          {loadingOlder ? 'Loading history…' : historyEnded ? 'No older history available' : historyRetrySeconds ? `Retry in ${historyRetrySeconds}s` : 'Load older'}
        </button>
        <p className="text-xs text-muted">{new Date(state.candles[0].time * 1000).toLocaleDateString()} – {new Date(state.candles.at(-1)!.time * 1000).toLocaleDateString()}</p>
      </div>}
      {historyError && <p className="px-4 py-3 text-sm text-danger" role="alert">{historyError}</p>}
    </div>
  )
}

function ChartCanvas({ candles, symbol, timeframe, position, onExitChange }: { candles: MarketCandle[]; symbol: string; timeframe: CandleTimeframe; position?: Position; onExitChange?: (levels: ExitLevels) => Promise<void> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const positionLinesRef = useRef<ReturnType<typeof attachPositionLines> | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const visibleRangeRef = useRef<IRange<Time> | null>(null)
  const [exitError, setExitError] = useState<string | null>(null)
  const [active, setActive] = useState(() => candles.at(-1) as MarketCandle)
  const latest = candles.at(-1) as MarketCandle
  const change = active.close - active.open
  const positive = change >= 0

  const renderChart = useCallback(() => {
    const container = containerRef.current
    if (!container) return undefined
    const styles = getComputedStyle(document.documentElement)
    const color = (name: string) => styles.getPropertyValue(name).trim()
    const gridColor = color('--color-line') + '70'
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: { background: { type: ColorType.Solid, color: color('--color-canvas') }, textColor: color('--color-muted'), fontFamily: styles.fontFamily },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      rightPriceScale: { borderColor: color('--color-line'), scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: color('--color-line'), timeVisible: true, secondsVisible: false, rightOffset: 3, barSpacing: 8, minBarSpacing: 3 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: color('--color-muted'), labelBackgroundColor: color('--color-surface') }, horzLine: { color: color('--color-muted'), labelBackgroundColor: color('--color-surface') } },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      localization: { priceFormatter: (price: number) => formatPrice(price).replace('$', '') },
    })
    const priceFormat = chartPriceFormat(latest.close)
    chartRef.current = chart
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: color('--color-primary'),
      downColor: color('--color-danger'),
      borderUpColor: color('--color-primary'),
      borderDownColor: color('--color-danger'),
      wickUpColor: color('--color-primary'),
      wickDownColor: color('--color-danger'),
      priceFormat,
    })
    candleSeries.setData(candles.map((candle) => ({ ...candle, time: candle.time as UTCTimestamp })))

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
    volumeSeries.setData(candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      value: candle.volume,
      color: candle.close >= candle.open ? color('--color-primary') : color('--color-danger'),
    })))

    if (overlayRef.current) positionLinesRef.current = attachPositionLines(chart, candleSeries, container, overlayRef.current, setExitError)
    if (visibleRangeRef.current) chart.timeScale().setVisibleRange(visibleRangeRef.current)
    else chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 100), to: candles.length + 3 })
    const crosshairHandler = (parameter: { seriesData: Map<unknown, unknown> }) => {
      const datum = parameter.seriesData.get(candleSeries) as CandlestickData | undefined
      if (datum && typeof datum.open === 'number') {
        const source = candles.find((candle) => candle.time === Number(datum.time))
        if (source) setActive(source)
      } else {
        setActive(latest)
      }
    }
    chart.subscribeCrosshairMove(crosshairHandler)
    const observer = new ResizeObserver(([entry]) => {
      if (entry) chart.applyOptions({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) })
    })
    observer.observe(container)

    return () => {
      visibleRangeRef.current = chart.timeScale().getVisibleRange()
      chartRef.current = null
      observer.disconnect()
      positionLinesRef.current?.dispose()
      positionLinesRef.current = null
      chart.unsubscribeCrosshairMove(crosshairHandler)
      chart.remove()
    }
  }, [candles, latest])

  useEffect(() => renderChart(), [renderChart])
  useEffect(() => { positionLinesRef.current?.update(position, onExitChange) }, [position, onExitChange, renderChart])

  return (
    <div className="terminal-chart-plot">
      <div className="terminal-candle-metrics flex min-h-12 flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-4 py-2 font-mono text-xs" aria-live="polite">
        <span className="font-semibold text-ink">{symbol} · {timeframe}</span>
        <CandleMetric label="O" value={active.open} />
        <CandleMetric label="H" value={active.high} />
        <CandleMetric label="L" value={active.low} />
        <CandleMetric label="C" value={active.close} />
        <span className={positive ? 'text-primary' : 'text-danger'}>{positive ? '+' : ''}{formatPrice(change)}</span>
        <span className="text-muted">Vol {formatVolume(active.volume)}</span>
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => chartRef.current?.timeScale().fitContent()} className="app-button focus-ring min-h-10 px-3 text-xs text-muted hover:text-ink">Fit history</button>
          <button type="button" onClick={() => chartRef.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 100), to: candles.length + 3 })} className="app-button focus-ring min-h-10 px-3 text-xs text-muted hover:text-ink">Latest</button>
        </div>
      </div>
      {exitError && <p className="border-b border-line px-4 py-3 text-sm text-danger" role="alert">{exitError}</p>}
      <div className="terminal-chart-viewport relative isolate">
        <div ref={containerRef} className="terminal-chart-canvas w-full" aria-label={`${symbol} ${timeframe} candlestick chart with ${candles.length} candles`} />
        <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
      </div>
      <p className="sr-only">Latest {symbol} candle opened at {formatPrice(latest.open)}, reached a high of {formatPrice(latest.high)}, a low of {formatPrice(latest.low)}, and closed at {formatPrice(latest.close)}.</p>
    </div>
  )
}

function CandleMetric({ label, value }: { label: string; value: number }) {
  return <span><span className="text-muted">{label}</span> <span className="text-ink">{formatPrice(value)}</span></span>
}

function chartPriceFormat(price: number) {
  if (price >= 100) return { type: 'price' as const, precision: 2, minMove: 0.01 }
  if (price >= 1) return { type: 'price' as const, precision: 4, minMove: 0.0001 }
  if (price >= 0.01) return { type: 'price' as const, precision: 6, minMove: 0.000001 }
  return { type: 'price' as const, precision: 10, minMove: 0.0000000001 }
}

function formatVolume(value: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
