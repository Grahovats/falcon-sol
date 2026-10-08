import type { PointerEvent } from 'react'

/** Track reflections on a surface that stays flat, using its own bounds. */
export function updateSurfaceSheen(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const surface = event.currentTarget
  const bounds = surface.getBoundingClientRect()
  const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / Math.max(bounds.width, 1) * 2 - 1))
  const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / Math.max(bounds.height, 1) * 2 - 1))
  surface.style.setProperty('--sheen-angle', `${125 + x * 18 - y * 10}deg`)
  surface.style.setProperty('--sheen-position', `${50 + x * 14 + y * 10}%`)
}

export function updateGlassSheen(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const card = event.currentTarget
  // Measure the untransformed wrapper so the tilt never feeds back into itself.
  const bounds = card.parentElement!.getBoundingClientRect()
  const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1))
  const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1))
  card.style.setProperty('--tilt-x', `${-y * 4}deg`)
  card.style.setProperty('--tilt-y', `${x * 5}deg`)
  card.style.setProperty('--sheen-angle', `${125 + x * 18 - y * 10}deg`)
  card.style.setProperty('--sheen-position', `${50 + x * 14 + y * 10}%`)
}

export function resetGlassSheen(event: PointerEvent<HTMLElement>) {
  const card = event.currentTarget
  card.style.setProperty('--tilt-x', '0deg')
  card.style.setProperty('--tilt-y', '0deg')
  card.style.setProperty('--sheen-angle', '125deg')
  card.style.setProperty('--sheen-position', '50%')
}
