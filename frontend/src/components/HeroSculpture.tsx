import { useEffect, useRef } from 'react'
import marketFallback from '../assets/market-hero-transparent.png'

const vertexShader = `
precision mediump float;
attribute vec3 position;
attribute vec3 normal;
attribute float material;
uniform float time;
uniform float aspect;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vLocal;
varying float vMaterial;
void main() {
  float a = -.38 + sin(time * .22) * .13;
  mat3 spin = mat3(cos(a), 0., sin(a), 0., 1., 0., -sin(a), 0., cos(a));
  float tilt = .36 + cos(time * .22) * .035;
  mat3 lean = mat3(1., 0., 0., 0., cos(tilt), sin(tilt), 0., -sin(tilt), cos(tilt));
  vec3 local = position;
  // Each candle and its illuminated seam share one quiet market rhythm.
  if (material > -.1 && material < .99 && position.y > -1.02) {
    local.y += sin(time * .65 + position.x * 1.4) * .045;
  }
  vec3 p = lean * spin * local;
  p.y += sin(time * .5) * .035;
  vNormal = lean * spin * normal;
  vPosition = p;
  vLocal = position;
  vMaterial = material;
  float depth = 7. - p.z;
  float scale = min(3.55, aspect * 2.6);
  gl_Position = vec4(p.x * scale / aspect, p.y * scale, (depth - 1.) / 12. * depth, depth);
}`
const fragmentShader = `
precision mediump float;
uniform float time;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vLocal;
varying float vMaterial;
void main() {
  vec3 n = normalize(vNormal);
  vec3 eye = normalize(vec3(0., 0., 7.) - vPosition);
  vec3 key = normalize(vec3(-3., 5., 4.));
  vec3 fill = normalize(vec3(4., 1., 2.));
  float diffuse = max(dot(n, key), 0.);
  float rim = pow(1. - max(dot(n, eye), 0.), 3.);
  float softbox = pow(max(dot(n, normalize(key + eye)), 0.), 30.);
  float edgeLight = pow(max(dot(n, normalize(fill + eye)), 0.), 70.);
  // Falcon's acid-lime accent with graphite and brushed titanium studio materials.
  vec3 lime = vec3(.722, .949, .239);
  vec3 metal = mix(vec3(.10, .14, .135), vec3(.30, .36, .31), step(.4, vMaterial));
  vec3 color = metal * (.48 + diffuse * .85);
  float strip = pow(max(dot(n, normalize(vec3(-.8, 1.8, 3.))), 0.), 14.);
  color += vec3(.65, .76, .72) * strip * .28;
  color += vec3(.88, .94, .9) * softbox * .8;
  color += lime * edgeLight * .32;
  color += vec3(.34, .43, .38) * rim * .55;
  if (vMaterial > .8) {
    color = lime * (.52 + diffuse * .48) + vec3(.8, .95, .62) * softbox * .5;
    float pulse = exp(-pow((vLocal.x - (mod(time * .48, 6.) - 3.)) * 5., 2.));
    color += vec3(.38, .42, .28) * pulse;
  }
  if (vMaterial < -.5) {
    color = vec3(.043, .06, .056) * (.75 + diffuse);
    color += vec3(.23, .31, .25) * softbox * .2;
    float contact = exp(-pow(vLocal.z * 3., 2.));
    color *= 1. - contact * .28;
  }
  // Soft highlight rolloff keeps the lime saturated without clipping the metal.
  color = color / (vec3(1.) + color * .35);
  gl_FragColor = vec4(color, 1.);
}`

type Vec3 = [number, number, number]
const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v) || 1
  return v.map((x) => x / length) as Vec3
}
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

function createMesh() {
  const vertices: number[] = []
  const indices: number[] = []
  // Rounded solid geometry catches the large studio lights along every bevel.
  const box = (center: Vec3, size: Vec3, radius: number, material: number) => {
    const half = size.map((x) => x / 2)
    const steps = 11
    // Concentrate subdivisions on the bevels, with a single flat center span.
    const coordinate = (step: number, extent: number) => {
      if (step <= 5) return -extent + radius * (1 - Math.cos(step / 5 * Math.PI / 2))
      return extent - radius * (1 - Math.sin((step - 6) / 5 * Math.PI / 2))
    }
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [-1, 1]) {
        const start = vertices.length / 7
        const u = (axis + 1) % 3
        const v = (axis + 2) % 3
        for (let i = 0; i <= steps; i++) {
          for (let j = 0; j <= steps; j++) {
            const point: Vec3 = [0, 0, 0]
            point[axis] = sign * half[axis]
            point[u] = coordinate(i, half[u])
            point[v] = coordinate(j, half[v])
            const core = point.map((x, k) => Math.max(-half[k] + radius, Math.min(half[k] - radius, x)))
            const normal = normalize(point.map((x, k) => x - core[k]) as Vec3)
            vertices.push(...core.map((x, k) => center[k] + x + normal[k] * radius), ...normal, material)
            if (i < steps && j < steps) {
              const a = start + i * (steps + 1) + j
              const b = a + steps + 1
              indices.push(a, b, a + 1, b, b + 1, a + 1)
            }
          }
        }
      }
    }
  }
  const tube = (points: Vec3[], radius: number, material: number) => {
    const start = vertices.length / 7
    const sides = 12
    points.forEach((point, i) => {
      const prev = points[Math.max(0, i - 1)]
      const next = points[Math.min(points.length - 1, i + 1)]
      const tangent = normalize(next.map((x, k) => x - prev[k]) as Vec3)
      const side = normalize(cross(tangent, [0, 0, 1]))
      const up = cross(side, tangent)
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * Math.PI * 2
        const normal = side.map((x, k) => x * Math.cos(a) + up[k] * Math.sin(a)) as Vec3
        vertices.push(...point.map((x, k) => x + normal[k] * radius), ...normal, material)
        if (i < points.length - 1 && j < sides) {
          const a = start + i * (sides + 1) + j
          const b = a + sides + 1
          indices.push(a, b, a + 1, b, b + 1, a + 1)
        }
      }
    })
  }

  box([0, -1.14, -.1], [4.6, .11, 1.55], .045, -1)
  box([0, -1.29, -.1], [4.32, .055, 1.35], .025, -1)
  // Recessed light at the platform's leading edge, like Falcon's active UI state.
  box([-1.65, -1.135, .678], [.58, .014, .009], .004, 1)
  box([1.65, -1.135, .678], [.58, .014, .009], .004, 1)
  // Fine guides are physical inlays on the floating trading plane.
  for (let i = 0; i < 9; i++) box([-2 + i * .5, -1.08, -.1], [.006, .003, 1.35], .001, .1)
  for (let i = 0; i < 4; i++) box([0, -1.08, -.7 + i * .4], [4.3, .003, .006], .001, .1)

  const candles = [
    [-1.72, -.57, .46], [-1.15, -.27, .63], [-.58, -.36, .38],
    [0, .08, .76], [.58, .15, .43], [1.15, .57, .7], [1.72, .85, .52],
  ]
  candles.forEach(([x, y, height], i) => {
    box([x, y, -.12], [.27, height, .27], .035, i === 2 || i === 4 ? .05 : .55)
    box([x, y, -.12], [.023, height + .34, .023], .006, .55)
    // A thin illuminated seam adds a precise operational accent.
    box([x, y - height / 2 + .018, .022], [.21, .025, .012], .005, .95)
  })

  const anchors: Vec3[] = [
    [-2.08, -.83, .43], [-1.65, -.66, .43], [-1.12, -.24, .43],
    [-.58, -.46, .43], [0, .15, .43], [.56, .02, .43], [1.15, .7, .43], [1.96, 1.2, .43],
  ]
  const path: Vec3[] = []
  for (let i = 0; i < anchors.length - 1; i++) {
    const p0 = anchors[Math.max(0, i - 1)]
    const p1 = anchors[i]
    const p2 = anchors[i + 1]
    const p3 = anchors[Math.min(anchors.length - 1, i + 2)]
    for (let j = 0; j < 24; j++) {
      const t = j / 24
      path.push(p1.map((value, k) => .5 * ((2 * value) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * value + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * value - 3 * p2[k] + p3[k]) * t * t * t)) as Vec3)
    }
  }
  path.push(anchors[anchors.length - 1])
  tube(path, .031, 1)
  const end = anchors[anchors.length - 1]
  box(end, [.12, .12, .12], .06, 1)
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}

/** A real lit 3D mesh, rendered without a scene library or image downloads. */
export function HeroSculpture() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true })
    if (!gl) return
    const shaders: WebGLShader[] = []
    const program = gl.createProgram()
    if (!program) return
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]] as const) {
      const shader = gl.createShader(type)
      if (!shader) continue
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        shaders.forEach((compiled) => gl.deleteShader(compiled))
        gl.deleteProgram(program)
        return
      }
      gl.attachShader(program, shader)
      shaders.push(shader)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      shaders.forEach((shader) => gl.deleteShader(shader))
      gl.deleteProgram(program)
      return
    }
    const mesh = createMesh()
    const vertexBuffer = gl.createBuffer()
    const indexBuffer = gl.createBuffer()
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
    for (const [name, offset] of [['position', 0], ['normal', 12], ['material', 24]] as const) {
      const attribute = gl.getAttribLocation(program, name)
      gl.enableVertexAttribArray(attribute)
      gl.vertexAttribPointer(attribute, name === 'material' ? 1 : 3, gl.FLOAT, false, 28, offset)
    }
    gl.enable(gl.DEPTH_TEST)
    const timeUniform = gl.getUniformLocation(program, 'time')
    const aspectUniform = gl.getUniformLocation(program, 'aspect')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let elapsed = 3
    let lastTime = 0
    let visible = true
    let disposed = false
    const contextLost = () => {
      cancelAnimationFrame(frame)
      delete canvas.dataset.ready
    }
    canvas.addEventListener('webglcontextlost', contextLost)
    const draw = (now: number) => {
      frame = 0
      if (disposed || gl.isContextLost()) return
      if (lastTime && !reducedMotion.matches) elapsed += Math.min((now - lastTime) / 1000, .05)
      lastTime = now
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.uniform1f(timeUniform, reducedMotion.matches ? 3 : elapsed)
      gl.uniform1f(aspectUniform, canvas.width / canvas.height)
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0)
      canvas.dataset.ready = 'true'
      if (visible && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(draw)
    }
    const refresh = () => {
      cancelAnimationFrame(frame)
      lastTime = 0
      draw(performance.now())
    }
    const resize = new ResizeObserver(() => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio))
      refresh()
    })
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      refresh()
    })
    resize.observe(canvas)
    visibility.observe(canvas)
    reducedMotion.addEventListener('change', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resize.disconnect()
      visibility.disconnect()
      reducedMotion.removeEventListener('change', refresh)
      document.removeEventListener('visibilitychange', refresh)
      canvas.removeEventListener('webglcontextlost', contextLost)
      delete canvas.dataset.ready
      gl.deleteBuffer(vertexBuffer)
      gl.deleteBuffer(indexBuffer)
      shaders.forEach((shader) => gl.deleteShader(shader))
      gl.deleteProgram(program)
    }
  }, [])

  return (
    <div className="falcon-hero-visual signal-scene" aria-hidden="true">
      <div className="signal-shadow" />
      <img className="signal-fallback" src={marketFallback} alt="" />
      <canvas ref={canvasRef} className="signal-canvas" />
    </div>
  )
}
