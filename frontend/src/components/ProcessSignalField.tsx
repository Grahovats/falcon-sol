import { useEffect, useRef, useState } from 'react'

const FLOW_FADE_BANDS = 24
const SIGNAL_TIMING = { traceMs: 700, cycleMs: 8000 } as const

type SignalLayout = { width: number; height: number; paths: string[] }

/** Route flowing signals from each card edge into the next card. */
export function ProcessSignalField({ revealedSteps = 4 }: { revealedSteps?: number }) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<SignalLayout | null>(null)
  const [animate, setAnimate] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setAnimate(!preference.matches)
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const parent = fieldRef.current?.parentElement
    if (!parent) return
    let frame = 0
    function measure() {
      frame = 0
      if (!parent) return
      const bounds = parent.getBoundingClientRect()
      const desktop = window.matchMedia('(min-width: 768px)').matches
      const steps = [...parent.querySelectorAll<HTMLElement>('[data-process-step]')]
      const cards = steps.map((step) => {
        const cardElement = step.querySelector<HTMLElement>('.journey-copy')!
        const stepBounds = step.getBoundingClientRect()
        // Use resting layout coordinates; card entrances and hover tilt must
        // not move the connector anchors while their geometry is measured.
        const card = {
          left: stepBounds.left + cardElement.offsetLeft,
          top: stepBounds.top + cardElement.offsetTop,
          width: cardElement.offsetWidth,
          height: cardElement.offsetHeight,
          right: stepBounds.left + cardElement.offsetLeft + cardElement.offsetWidth,
        }
        const node = step.querySelector<HTMLElement>(desktop ? '.journey-node-desktop' : '.journey-node-mobile')!.getBoundingClientRect()
        return {
          left: card.left - bounds.left, top: card.top - bounds.top,
          width: card.width, height: card.height,
          right: card.right - bounds.left,
          nodeX: node.left - bounds.left + node.width / 2,
          nodeY: node.top - bounds.top + node.height / 2,
        }
      })
      const paths = cards.slice(0, -1).map((from, index) => {
        const to = cards[index + 1]
        if (!desktop) {
          const startY = from.nodeY + 14
          const endY = to.nodeY - 14
          const span = endY - startY
          const bend = index === 1 ? 12 : 6
          return `M ${from.nodeX} ${startY} C ${from.nodeX + bend} ${startY + span * 0.3}, ${to.nodeX - bend} ${endY - span * 0.3}, ${to.nodeX} ${endY}`
        }
        if (index !== 1) {
          const startX = from.right
          const startY = from.top + from.height * (index === 0 ? 0.65 : 0.55)
          const endX = to.left
          const endY = index === 0
            ? Math.max(to.top + 48, Math.min(startY, to.top + to.height - 48))
            : to.top + to.height * 0.65
          if (index === 2) {
            const middleX = (startX + endX) / 2
            const direction = endY >= startY ? 1 : -1
            const radius = Math.min(32, (endX - startX) / 3, Math.abs(endY - startY) / 3)
            return `M ${startX} ${startY} H ${middleX - radius} Q ${middleX} ${startY}, ${middleX} ${startY + direction * radius} V ${endY - direction * radius} Q ${middleX} ${endY}, ${middleX + radius} ${endY} H ${endX}`
          }
          const reach = (endX - startX) * 0.5
          return `M ${startX} ${startY} C ${startX + reach} ${startY}, ${endX - reach} ${endY}, ${endX} ${endY}`
        }
        const startX = from.left + from.width * 0.5
        const startY = from.top + from.height
        const endX = to.left + to.width * 0.62
        const endY = to.top
        const middleY = (startY + endY) / 2
        const direction = endX >= startX ? 1 : -1
        const radius = Math.min(48, (endY - startY) * 0.35, Math.abs(endX - startX) / 3)
        // A straight return with rounded corners stays within the row gap.
        return `M ${startX} ${startY} V ${middleY - radius} Q ${startX} ${middleY}, ${startX + direction * radius} ${middleY} H ${endX - direction * radius} Q ${endX} ${middleY}, ${endX} ${middleY + radius} V ${endY}`
      })
      setLayout({ width: bounds.width, height: bounds.height, paths })
    }
    function scheduleMeasure() { if (!frame) frame = window.requestAnimationFrame(measure) }
    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(parent)
    parent.querySelectorAll<HTMLElement>('.journey-copy').forEach((card) => observer.observe(card))
    window.addEventListener('resize', scheduleMeasure)
    scheduleMeasure()
    return () => { observer.disconnect(); window.removeEventListener('resize', scheduleMeasure); window.cancelAnimationFrame(frame) }
  }, [])

  useEffect(() => {
    const field = fieldRef.current
    if (!field || !layout) return
    const flows = [...field.querySelectorAll<SVGPathElement>('.process-signal-flow')]
    // Start on the first drawn connector and extend the loop as more appear.
    const visibleConnectors = Math.min(layout.paths.length, Math.max(0, revealedSteps - 1))
    flows.forEach((flow) => { flow.style.opacity = '0' })
    if (visibleConnectors === 0) {
      flows.forEach((flow) => { flow.style.opacity = '0' })
      return
    }
    // Treat the visible connectors as one route with zero distance inside boxes.
    // Split the same pulse across both sides during each handoff so its tail
    // drains naturally while its front emerges, without jumping or waiting.
    const routes = [...field.querySelectorAll<SVGPathElement>('.process-signal-route')]
    const lengths = routes.slice(0, visibleConnectors).map((path) => path.getTotalLength())
    const total = lengths.reduce((sum, length) => sum + length, 0)
    if (total <= 0) return
    let frame = 0
    let started: number | null = null
    const pulse = Math.min(220, total * 0.7, Math.max(60, total * 0.22))
    function draw(head: number) {
      const bandLength = pulse / FLOW_FADE_BANDS
      let start = 0
      lengths.forEach((length, index) => {
        const end = start + length
        for (let band = 0; band < FLOW_FADE_BANDS; band++) {
          const flow = flows[index * FLOW_FADE_BANDS + band]
          const bandStart = (head - pulse + band * bandLength + total) % total
          const bandEnd = bandStart + bandLength
          let visibleStart = Math.max(start, bandStart)
          let visibleEnd = Math.min(end, bandEnd)
          if (bandEnd > total && visibleEnd <= visibleStart) {
            visibleStart = start
            visibleEnd = Math.min(end, bandEnd - total)
          }
          const visibleLength = Math.max(0, visibleEnd - visibleStart)
          // The opacity envelope follows the pulse, even across box handoffs.
          const opacity = Math.sin(Math.PI * (band + 0.5) / FLOW_FADE_BANDS) ** 2
          flow.style.opacity = visibleLength > 0 ? String(opacity) : '0'
          if (visibleLength > 0) {
            flow.style.strokeDasharray = `${visibleLength} ${total + pulse}`
            flow.style.strokeDashoffset = String(-(visibleStart - start))
          }
        }
        start = end
      })
    }
    const initialDistance = pulse
    if (!animate) { draw(initialDistance); return }
    flows.forEach((flow) => { flow.style.opacity = '0' })
    function tick(now: number) {
      if (started === null) started = now
      draw((initialDistance + (now - started) / SIGNAL_TIMING.cycleMs * total) % total)
      frame = window.requestAnimationFrame(tick)
    }
    const timer = window.setTimeout(() => { frame = window.requestAnimationFrame(tick) }, SIGNAL_TIMING.traceMs)
    return () => { window.clearTimeout(timer); window.cancelAnimationFrame(frame) }
  }, [layout, animate, revealedSteps])

  return <div ref={fieldRef} className="process-signal-field" aria-hidden="true">
    {layout && <svg width={layout.width} height={layout.height} className="process-signal-map">
      {layout.paths.map((route, index) => <g key={index}>
        <path d={route} pathLength="1" className={`process-signal-route${!animate || revealedSteps >= index + 2 ? ' process-signal-route-drawn' : ''}`} />
        <path d={route} pathLength="1" className={`process-signal-trace${revealedSteps >= index + 2 ? ' process-signal-route-drawn' : ''}${animate && revealedSteps === index + 2 ? ' process-signal-trace-active' : ''}`} />
      </g>)}
      <g className="process-signal-flow-glow">
        {layout.paths.flatMap((route, index) => Array.from({ length: FLOW_FADE_BANDS }, (_, band) => <path key={`flow-${index}-${band}`} d={route} className="process-signal-flow" style={{ opacity: 0 }} />))}
      </g>
    </svg>}
  </div>
}
