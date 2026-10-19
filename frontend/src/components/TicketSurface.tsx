import { animate } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import './TicketSurface.css'

/* HOVER STORYBOARD
 *    0ms  Tension builds at the top perforation.
 *  130ms  The seam begins opening; the paper rolls along its exposed edge.
 *  820ms  The tear stops at 86%, with a broad paper bridge still attached.
 * 1000ms  The curl settles. Leaving reverses from its current position in 350ms.
 * The paper and content stay inside fixed interaction bounds.
 */
const TIMING = { open: 1, close: 0.35 } as const
const MOTION_QUERY = '(min-width: 768px) and (hover: hover) and (prefers-reduced-motion: no-preference)'
const subscribeMotion = (callback: () => void) => {
  const query = window.matchMedia(MOTION_QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const getMotion = () => window.matchMedia(MOTION_QUERY).matches
const noMotion = () => false
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }
const point = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`

/** Geometry is measured in pixels so the fibers don't stretch on wide screens. */
function paperGeometry(width: number, height: number, progress: number) {
  const pull = smooth(progress)
  const tear = smooth((progress - 0.08) / 0.82)
  const tip = height * 0.86 * tear
  const opening = Math.min(29, width * 0.13) * pull
  const edge = (y: number) => {
    const looseness = tip > 0 ? clamp(1 - y / tip) : 0
    const tension = Math.pow(looseness, 1.25)
    // Fine, irregular fibers belong to the paper and don't change every frame.
    const fiber = (Math.sin(y * 2.17) * 0.45 + Math.sin(y * 0.83) * 0.3) * smooth(looseness * 12) * tear
    return Math.max(0, opening * tension + fiber)
  }
  const lift = (y: number) => 5 * pull * (1 - y / height) ** 3
  // Fixed samples preserve fiber density while the tear point travels downward.
  const count = Math.max(1, Math.ceil(height / 2))
  const samples = Array.from({ length: count + 1 }, (_, index) => height * index / count)
  const left = samples.map(y => point(edge(y), y + lift(y)))
  const inset = 11 * pull
  const topRight = width - inset
  const right = Array.from({ length: 17 }, (_, i) => {
    const y = 8 + (height - 16) * i / 16
    return point(width - inset * (1 - y / height) ** 2, y)
  })
  const paper = `M${left[0]} Q${width * 0.5},${-2 * pull} ${topRight - 8},0 Q${topRight},0 ${right[0]} L${right.join(' L')} Q${width},${height} ${width - 8},${height} L${left.toReversed().join(' L')} Z`
  const tornSamples = samples.filter(y => y < tip)
  tornSamples.push(tip)
  const cut = tornSamples.map(y => point(edge(y), y + lift(y)))
  const curlInner = tornSamples.toReversed().map(y => {
    const amount = tip > 0 ? Math.pow(clamp(1 - y / tip), 0.65) : 0
    return point(edge(y) + 10 * pull * amount, y + lift(y))
  })
  return { paper, edge: `M${cut.join(' L')}`, curl: `M${cut.join(' L')} L${curlInner.join(' L')} Z`, tip, pull, top: point(edge(0), lift(0)) }
}

export function TicketSurface({ active: controlledActive, enabled: controlledEnabled, shading = true, className, children }: { active?: boolean; enabled?: boolean; shading?: boolean; className: string; children: ReactNode }) {
  const motionEnabled = useSyncExternalStore(subscribeMotion, getMotion, noMotion)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const enabled = controlledEnabled ?? motionEnabled
  const active = enabled && (controlledActive ?? (hovered || focused))
  const host = useRef<HTMLDivElement>(null)
  const current = useRef(0)
  const [progress, setProgress] = useState(0)
  const [size, setSize] = useState({ width: 300, height: 220 })
  const id = useId().replace(/:/g, '')

  useEffect(() => {
    const element = host.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!enabled) return
    const controls = animate(current.current, active ? 1 : 0, {
      duration: active ? TIMING.open : TIMING.close,
      ease: active ? [0.35, 0, 0.2, 1] : [0.22, 1, 0.36, 1],
      onUpdate: value => { current.current = value; setProgress(value) },
    })
    return () => controls.stop()
  }, [active, enabled])

  const p = enabled ? progress : 0
  const { width: w, height: h } = size
  const shape = paperGeometry(w, h, p)
  const [notchX, notchY] = shape.top.split(',')

  return <div ref={host} className={className} data-ticket-active={active} style={{ '--ticket-pull': shape.pull } as CSSProperties}
    onPointerEnter={event => { if (event.pointerType === 'mouse' || event.pointerType === 'pen') setHovered(true) }}
    onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <div className="ticket-paper" aria-hidden="true">
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="ticket-paper-svg">
      <defs>
        <mask id={`${id}-mask`}>
          <path d={shape.paper} fill="white" />
          <circle cx={notchX} cy={notchY} r="8" fill="black" />
          <circle cx="0" cy={h} r="8" fill="black" />
        </mask>
        <linearGradient id={`${id}-bend`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="black" stopOpacity=".22" />
          <stop offset=".12" stopColor="white" stopOpacity=".12" />
          <stop offset=".3" stopColor="white" stopOpacity="0" />
          <stop offset=".78" stopColor="black" stopOpacity=".025" />
          <stop offset="1" stopColor="black" stopOpacity=".12" />
        </linearGradient>
        <linearGradient id={`${id}-back`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--color-primary-ink)" stopOpacity=".7" />
          <stop offset=".2" stopColor="var(--ticket-paper-back)" />
          <stop offset=".6" stopColor="var(--ticket-paper-back)" />
          <stop offset="1" stopColor="var(--color-primary)" />
        </linearGradient>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <filter id={`${id}-shadow`} x="-50%" y="-10%" width="200%" height="130%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      {shading && <path d={shape.edge} fill="none" stroke="var(--color-primary-ink)" strokeWidth={5 * shape.pull} opacity=".3" filter={`url(#${id}-shadow)`} />}
      <g mask={`url(#${id}-mask)`}>
        <path d={shape.paper} fill="var(--color-primary)" />
        {shading && <path d={shape.paper} fill={`url(#${id}-bend)`} opacity={shape.pull} />}
        <rect width={w} height={h} filter={`url(#${id}-grain)`} opacity=".045" />
        <path d={shape.curl} fill={shading ? `url(#${id}-back)` : 'var(--color-primary)'} opacity={shape.pull} />
        <path d={shape.edge} fill="none" stroke={shading ? 'var(--ticket-paper-back)' : 'var(--color-primary)'} strokeWidth=".8" opacity={shape.pull * 0.9} />
        <path d={`M.6,${Math.max(8, shape.tip)} V${h - 8}`} fill="none" stroke="var(--color-primary-ink)" strokeOpacity=".35" strokeWidth="1" strokeDasharray="3 5" />
      </g>
    </svg>
    </div>
    {children}
  </div>
}
