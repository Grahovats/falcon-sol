import { useId } from 'react'
import type { CSSProperties } from 'react'
import './HomeAtmosphere.css'
import { useAmbientActivity } from '../lib/use-ambient-activity'

const stars = Array.from({ length: 48 }, (_, index) => ({
  left: `${3 + ((index * 37 + 13) % 94)}%`,
  top: `${2 + ((index * 29 + 5) % 96)}%`,
  '--atmosphere-star-size': `${index % 9 === 0 ? 2 : 1}px`,
} as CSSProperties))

const illuminatedOrbits = [
  { cx: 120, cy: 760, rx: 1110, ry: 526, rotation: -28, secondary: false },
  { cx: 1520, cy: 1520, rx: 900, ry: 410, rotation: -24, secondary: true },
]

/** One continuous vector atmosphere behind the landing page's lower sections. */
export function HomeAtmosphere() {
  const { ref, active } = useAmbientActivity()
  const gradientId = useId()
  return <div ref={ref} className="home-atmosphere" data-ambient-active={active} aria-hidden="true">
    <div className="home-atmosphere-light home-atmosphere-light-left" />
    <div className="home-atmosphere-light home-atmosphere-light-right" />
    <div className="home-atmosphere-stars">
      {stars.map((style, index) => <span key={index} style={style} />)}
    </div>
    <svg className="home-atmosphere-orbits" viewBox="0 0 1600 1800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1300" y2="1600" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.04" />
          <stop offset="0.35" stopColor="currentColor" stopOpacity="0.34" />
          <stop offset="0.65" stopColor="currentColor" stopOpacity="0.08" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.38" />
        </linearGradient>
      </defs>
      <g className="home-atmosphere-contours" stroke={`url(#${gradientId})`}>
        {Array.from({ length: 4 }, (_, index) => <ellipse key={index} cx="120" cy="760" rx={1030 + index * 40} ry={470 + index * 28} transform="rotate(-28 120 760)" />)}
        {Array.from({ length: 3 }, (_, index) => <ellipse key={index} cx="1520" cy="1520" rx={804 + index * 48} ry={346 + index * 32} transform="rotate(-24 1520 1520)" />)}
      </g>
      <g className="home-atmosphere-traces">
        {[true, false].map(halo => <g key={String(halo)}>
          {illuminatedOrbits.map(({ cx, cy, rx, ry, rotation, secondary }, index) => <ellipse
            key={index}
            className={`home-atmosphere-trace${halo ? ' home-atmosphere-trace-halo' : ''}${secondary ? ' home-atmosphere-trace-secondary' : ''}`}
            cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rotation} ${cx} ${cy})`} pathLength="1"
            style={{ '--orbit-delay': `${-index * 7 - 3}s` } as CSSProperties}
          />)}
        </g>)}
      </g>
    </svg>
    <div className="home-atmosphere-fade" />
  </div>
}
