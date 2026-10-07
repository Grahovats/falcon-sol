import type { ReactNode } from 'react'
import { resetGlassSheen, updateGlassSheen } from '../lib/glass-hover'

/** Share the process cards' frosted surface and glass reflection. */
export function GlassPanel({ children, className = '', interactive = true }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return <div className={`home-glass-host ${className}`}>
    <div className="falcon-glass" onPointerEnter={interactive ? updateGlassSheen : undefined} onPointerMove={interactive ? updateGlassSheen : undefined} onPointerLeave={interactive ? resetGlassSheen : undefined}>
      <span className="journey-sheen" aria-hidden="true" />
      {children}
    </div>
  </div>
}
