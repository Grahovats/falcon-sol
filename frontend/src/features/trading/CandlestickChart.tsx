import { RotateCw } from 'lucide-react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getCandles } from '../../api/trading'
import { formatPrice } from '../../lib/format'
import type { CandleTimeframe, MarketCandle } from '../../types/trading'

const timeframes: CandleTimeframe[] = ['5m', '15m', '1h', '4h']
type CandleState =
  | { status: 'loading' }
  | { status: 'success'; candles: MarketCandle[] }
  | { status: 'error'; message: string }

interface CandlestickChartProps {
  missionId: string
  marketId: string
  symbol: string
}

export function CandlestickChart({ missionId, marketId, symbol }: CandlestickChartProps) {
  const [timeframe, setTimeframe] = useState<CandleTimeframe>('5m')
  const [state, setState] = useState<CandleState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void getCandles(missionId, marketId, timeframe, controller.signal)
      .then(({ data }) => setState(data.length ? { status: 'success', candles: data } : { status: 'error', message: 'No candles are available for this market yet.' }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Candle history could not be loaded.' })
      })
    return () => controller.abort()
  }, [marketId, missionId, reloadKey, timeframe])

  return (
    <div className="border-t border-line bg-canvas/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2">
        <div className="flex items-center gap-1" aria-label="Chart timeframe">
          {timeframes.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={timeframe === value}
              onClick={() => { setState({ status: 'loading' }); setTimeframe(value) }}
              className={`focus-ring min-h-10 min-w-11 px-3 font-mono text-xs transition-colors ${timeframe === value ? 'bg-primary text-primary-ink' : 'text-muted hover:bg-surface hover:text-ink'}`}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted">USD · GeckoTerminal OHLC</p>
      </div>

      {state.status === 'loading' && <ChartSkeleton symbol={symbol} />}
      {state.status === 'error' && (
        <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
          <p className="text-sm font-medium text-ink">Chart unavailable</p>
          <p className="max-w-md text-sm text-muted">{state.message}</p>
          <button type="button" onClick={() => { setState({ status: 'loading' }); setReloadKey((value) => value + 1) }} className="focus-ring inline-flex min-h-10 items-center gap-2 border border-line px-4 text-sm text-ink hover:border-primary">
            <RotateCw className="size-4" aria-hidden="true" /> Retry chart
          </button>
        </div>
      )}
      {state.status === 'success' && <ChartCanvas key={`${marketId}:${timeframe}`} candles={state.candles} symbol={symbol} timeframe={timeframe} />}
    </div>
  )
}

function ChartCanvas({ candles, symbol, timeframe }: { candles: MarketCandle[]; symbol: string; timeframe: CandleTimeframe }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(() => candles.at(-1) as MarketCandle)
  const latest = candles.at(-1) as MarketCandle
  const change = active.close - active.open
  const positive = change >= 0

  const renderChart = useCallback(() => {
    const container = containerRef.current
    if (!container) return undefined
    const styles = getComputedStyle(document.documentElement)
    const color = (name: string) => styles.getPropertyValue(name).trim()
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: { background: { type: ColorType.Solid, color: color('--color-canvas') }, textColor: color('--color-muted'), fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
      grid: { vertLines: { color: color('--color-line') }, horzLines: { color: color('--color-line') } },
      rightPriceScale: { borderColor: color('--color-line'), scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: color('--color-line'), timeVisible: true, secondsVisible: false, rightOffset: 3, barSpacing: 8, minBarSpacing: 3 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: color('--color-muted'), labelBackgroundColor: color('--color-surface') }, horzLine: { color: color('--color-muted'), labelBackgroundColor: color('--color-surface') } },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      localization: { priceFormatter: (price: number) => formatPrice(price).replace('$', '') },
    })
    const priceFormat = chartPriceFormat(latest.close)
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

    chart.timeScale().fitContent()
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
      observer.disconnect()
      chart.unsubscribeCrosshairMove(crosshairHandler)
      chart.remove()
    }
  }, [candles, latest])

  useEffect(() => renderChart(), [renderChart])

  return (
    <div>
      <div className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-4 py-2 font-mono text-xs" aria-live="polite">
        <span className="font-semibold text-ink">{symbol} · {timeframe}</span>
        <CandleMetric label="O" value={active.open} />
        <CandleMetric label="H" value={active.high} />
        <CandleMetric label="L" value={active.low} />
        <CandleMetric label="C" value={active.close} />
        <span className={positive ? 'text-primary' : 'text-danger'}>{positive ? '+' : ''}{formatPrice(change)}</span>
        <span className="text-muted">Vol {formatVolume(active.volume)}</span>
      </div>
      <div ref={containerRef} className="h-80 w-full sm:h-96" aria-label={`${symbol} ${timeframe} candlestick chart with ${candles.length} candles`} />
      <p className="sr-only">Latest {symbol} candle opened at {formatPrice(latest.open)}, reached a high of {formatPrice(latest.high)}, a low of {formatPrice(latest.low)}, and closed at {formatPrice(latest.close)}.</p>
    </div>
  )
}

function CandleMetric({ label, value }: { label: string; value: number }) {
  return <span><span className="text-muted">{label}</span> <span className="text-ink">{formatPrice(value)}</span></span>
}

function ChartSkeleton({ symbol }: { symbol: string }) {
  return <div className="min-h-80 animate-pulse p-4 sm:min-h-96" aria-busy="true" aria-label={`Loading ${symbol} candlestick chart`}><div className="h-8 w-2/3 bg-line" /><div className="mt-4 h-64 bg-surface sm:h-72" /></div>
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
