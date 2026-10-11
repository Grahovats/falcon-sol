// A sculpted, closed braid occupies the hero's right half. No point markers.
const SCULPTURE = { strands: 25, crossSections: 48, samples: 192, tubeRadius: 40 }
type Vector = { x: number; y: number; z: number }

function center(angle: number): Vector {
  const radius = 225 + 66 * Math.cos(3 * angle)
  return { x: radius * Math.cos(2 * angle), y: radius * Math.sin(2 * angle), z: 95 * Math.sin(3 * angle) }
}

function normalize(vector: Vector): Vector {
  const length = Math.max(Math.hypot(vector.x, vector.y, vector.z), 0.001)
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

function project(angle: number, section: number) {
  const origin = center(angle)
  const before = center(angle - 0.001)
  const after = center(angle + 0.001)
  const tangent = normalize({ x: after.x - before.x, y: after.y - before.y, z: after.z - before.z })
  const normal = normalize({ x: -tangent.y, y: tangent.x, z: 0 })
  const binormal = {
    x: tangent.y * normal.z - tangent.z * normal.y,
    y: tangent.z * normal.x - tangent.x * normal.z,
    z: tangent.x * normal.y - tangent.y * normal.x,
  }
  const offset = SCULPTURE.tubeRadius
  const x = origin.x + offset * (normal.x * Math.cos(section) + binormal.x * Math.sin(section))
  const y = origin.y + offset * (normal.y * Math.cos(section) + binormal.y * Math.sin(section))
  const z = origin.z + offset * (normal.z * Math.cos(section) + binormal.z * Math.sin(section))
  // Rotate in three dimensions before projecting, so the crossings have depth.
  const tiltedY = y * Math.cos(0.55) - z * Math.sin(0.55)
  const tiltedZ = y * Math.sin(0.55) + z * Math.cos(0.55)
  const tiltedX = x * Math.cos(-0.35) + tiltedZ * Math.sin(-0.35)
  const depth = -x * Math.sin(-0.35) + tiltedZ * Math.cos(-0.35)
  const perspective = 1000 / (1000 - depth)
  return {
    x: 550 + (tiltedX * Math.cos(-0.4) - tiltedY * Math.sin(-0.4)) * 1.2 * perspective,
    y: 400 + (tiltedX * Math.sin(-0.4) + tiltedY * Math.cos(-0.4)) * 1.25 * perspective,
  }
}

function contourPath(section: number) {
  return Array.from({ length: SCULPTURE.samples }, (_, index) => {
    const point = project(index / SCULPTURE.samples * Math.PI * 2, section)
    return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }).join(' ') + ' Z'
}

const strands = Array.from({ length: SCULPTURE.strands }, (_, index) => contourPath(index / SCULPTURE.strands * Math.PI * 2))
const sections = Array.from({ length: SCULPTURE.crossSections }, (_, index) => {
  const angle = index / SCULPTURE.crossSections * Math.PI * 2
  return Array.from({ length: 32 }, (_, step) => {
    const point = project(angle, step / 32 * Math.PI * 2)
    return `${step === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }).join(' ') + ' Z'
})
const traces = [contourPath(0.4), contourPath(2.5), contourPath(4.7)]

export function HeroSignalField() {
  return (
    <div className="hero-signal-field hero-signal-field-knot" aria-hidden="true">
      <div className="hero-signal-grain" />
      <svg className="hero-signal-map" viewBox="0 0 1000 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="signal-fade" x1="150" y1="700" x2="950" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.06" />
            <stop offset="0.35" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="0.7" stopColor="currentColor" stopOpacity="0.72" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <g className="hero-knot-sculpture">
          <g className="hero-knot-depth">
            {strands.filter((_, index) => index % 3 === 0).map((path, index) => <path key={index} d={path} />)}
          </g>
          <g className="hero-knot-contours">
            {strands.map((path, index) => <path key={index} d={path} />)}
          </g>
          <g className="hero-knot-sections">
            {sections.map((path, index) => <path key={index} d={path} />)}
          </g>
          <g className="hero-signal-routes">
            {traces.map((path, index) => <path key={index} className={`hero-signal-route${index > 0 ? ' hero-signal-route-muted' : ''}`} pathLength="1" d={path} />)}
            <g className="process-signal-flow-glow">
              {traces.map((path, index) => <path key={index} className={`hero-signal-flow ${index === 0 ? 'hero-signal-flow-primary' : 'hero-signal-flow-secondary'}`} pathLength="1" d={path} />)}
            </g>
          </g>
        </g>
      </svg>
      <div className="hero-signal-vignette" />
    </div>
  )
}
