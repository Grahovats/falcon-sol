import { useEffect, useRef, useState } from 'react'

/** Decorative effects stay continuous in view and pause only offscreen or in hidden tabs. */
export function useAmbientActivity() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let visible = !('IntersectionObserver' in window)
    const update = () => setActive(visible && !document.hidden)
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      update()
    }) : undefined
    observer?.observe(element)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return { ref, active }
}
