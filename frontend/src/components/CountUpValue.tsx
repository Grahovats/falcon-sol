import { useEffect, useState } from 'react'
import { formatPercent } from '../lib/format'

// After the entrance delay -> count from zero -> reach the exact value in 2500 ms.
const TIMING = { duration: 2500 }
type NumberFormat = 'count' | 'percent' | 'rate'

function formatValue(value: number, format: NumberFormat) {
  if (format === 'percent') return formatPercent(value)
  if (format === 'rate') return `${value.toFixed(1)}%`
  return String(Math.round(value))
}

export function CountUpValue({ value, format = 'count', delayMs = 0 }: { value: number | null; format?: NumberFormat; delayMs?: number }) {
  const [progress, setProgress] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches) return

    let frame: number
    let start: number | undefined
    const tick = (timestamp: number) => {
      start ??= timestamp + delayMs
      const elapsed = Math.max(0, Math.min((timestamp - start) / TIMING.duration, 1))
      setProgress(1 - (1 - elapsed) ** 3)
      if (elapsed < 1) frame = window.requestAnimationFrame(tick)
    }
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return
      window.cancelAnimationFrame(frame)
      setProgress(1)
    }

    frame = window.requestAnimationFrame(tick)
    preference.addEventListener('change', onPreferenceChange)
    return () => {
      window.cancelAnimationFrame(frame)
      preference.removeEventListener('change', onPreferenceChange)
    }
  }, [delayMs])

  if (value === null || !Number.isFinite(value)) return <>—</>

  return <>
    <span aria-hidden="true">{formatValue(value * progress, format)}</span>
    <span className="sr-only">{formatValue(value, format)}</span>
  </>
}
