import type { ReactNode } from 'react'
import './ChartLoading.css'

export function ChartLoading({ symbol, detail = 'Fetching candle history', children }: { symbol: string; detail?: string; children?: ReactNode }) {
  return <div className="terminal-chart-canvas chart-loading" aria-busy="true" aria-label={`Loading ${symbol} chart`}>
    <div className="chart-loading-content">
      <svg className="chart-loading-signal" viewBox="0 0 64 40" fill="none" aria-hidden="true">
        {[12, 22, 34, 22, 12].map((height, index) => <rect key={index} className={`chart-loading-bar chart-loading-bar-${index}`} x={8 + index * 11} y={(40 - height) / 2} width="4" height={height} rx="2" />)}
      </svg>
      <p className="mt-4 text-sm font-medium text-ink" role="status">Loading {symbol} chart</p>
      <p className="mt-2 text-xs text-muted">{detail}</p>
      <div className="chart-loading-track" aria-hidden="true"><span /></div>
      {children}
    </div>
  </div>
}
