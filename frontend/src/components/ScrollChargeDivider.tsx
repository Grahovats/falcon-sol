import { useEffect, useRef } from 'react'

const START_FILL = 0.1

export function ScrollChargeDivider() {
  const dividerRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const divider = dividerRef.current
    const fill = fillRef.current
    if (!divider || !fill) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0

    function update() {
      frame = 0
      if (!divider || !fill) return
      const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-header-height')) || 0
      const dividerTop = divider.getBoundingClientRect().top + window.scrollY
      const distance = Math.max(1, dividerTop - headerHeight)
      const progress = reducedMotion.matches ? 0 : Math.min(1, Math.max(0, window.scrollY / distance))
      fill.style.transform = `scaleX(${START_FILL + (1 - START_FILL) * progress})`
    }
    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    reducedMotion.addEventListener('change', scheduleUpdate)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      reducedMotion.removeEventListener('change', scheduleUpdate)
    }
  }, [])

  return <div ref={dividerRef} className="h-px overflow-hidden bg-line" aria-hidden="true">
    <span ref={fillRef} className="block h-full w-full origin-left bg-primary" style={{ transform: `scaleX(${START_FILL})` }} />
  </div>
}
