import "./HeroPlanetHorizon.css";
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useAmbientActivity } from '../lib/use-ambient-activity';

// Deterministic positions keep the sky stable across renders and reloads.
const stars = Array.from({ length: 64 }, (_, index) => ({
  left: `${2 + ((index * 37 + 11) % 97)}%`,
  top: `${3 + ((index * 23 + 7) % 94)}%`,
  "--star-size": `${index % 7 === 0 ? 2 : 1}px`,
  "--star-duration": `${4 + (index % 6)}s`,
  "--star-delay": `${-(index % 13) * 0.7}s`,
} as CSSProperties));

const shootingStars = [
  { left: "82%", top: "10%", "--shooting-duration": "11s", "--shooting-delay": "0.8s" },
  { left: "42%", top: "6%", "--shooting-duration": "17s", "--shooting-delay": "4s" },
  { left: "95%", top: "32%", "--shooting-duration": "13s", "--shooting-delay": "7s" },
  { left: "57%", top: "23%", "--shooting-duration": "19s", "--shooting-delay": "10s" },
] satisfies (CSSProperties & {
  "--shooting-duration": string;
  "--shooting-delay": string;
})[];

// Fine Gaussian-weighted strokes soften the halo without a blur filter surface.
const horizonGlow = Array.from({ length: 48 }, (_, index) => {
  const width = (48 - index) * 2;
  return { width, opacity: 0.035 * Math.exp(-0.5 * (width / 26) ** 2) };
});

// Concentrate the thickness at the crown, with a fine line along the shoulders.
const horizonEdge = `M 0 550 A 700 550 0 0 1 1400 550 ${Array.from({ length: 241 }, (_, index) => {
  const angle = Math.PI * (1 - index / 240);
  const across = -Math.cos(angle);
  const thickness = (2.2 + 2.6 * Math.exp(-0.5 * (across / 0.4) ** 2)) * Math.sin(angle);
  return `L ${(700 + 700 * across).toFixed(3)} ${(550 - 550 * Math.sin(angle) + thickness).toFixed(3)}`;
}).join(' ')} Z`;

const FLOW_BANDS = 32;
const FLOW_ROUTE = "M 1400 550 A 700 550 0 0 0 0 550";

/** Use the same frame-driven, softly faded signal as ProcessSignalField. */
function HorizonFlow({ active }: { active: boolean }) {
  const groupRef = useRef<SVGGElement>(null);
  const phaseRef = useRef(0.2);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const paths = [...group.querySelectorAll<SVGPathElement>('path')];
    const length = paths[0].getTotalLength();
    const pulse = Math.min(220, length * 0.22);
    const bandLength = pulse / FLOW_BANDS;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous: number | null = null;

    function tick(now: number) {
      if (previous !== null) phaseRef.current = (phaseRef.current + (now - previous) / 8000) % 1;
      previous = now;
      const head = phaseRef.current * length;
      paths.forEach((path, index) => {
        const band = index % FLOW_BANDS;
        const start = (head - pulse + band * bandLength + length) % length;
        path.style.strokeDasharray = `${bandLength + 0.2} ${length + pulse}`;
        path.style.strokeDashoffset = String(-start);
      });
      frame = window.requestAnimationFrame(tick);
    }
    function update() {
      window.cancelAnimationFrame(frame);
      previous = null;
      group!.style.opacity = active && !preference.matches ? '1' : '0';
      if (active && !preference.matches) frame = window.requestAnimationFrame(tick);
    }
    update();
    preference.addEventListener('change', update);
    return () => {
      window.cancelAnimationFrame(frame);
      preference.removeEventListener('change', update);
    };
  }, [active]);

  return <g ref={groupRef} className="hero-arc-flow" fill="none" stroke="var(--color-primary)">
    {[true, false].map((halo) => <g key={String(halo)} strokeWidth={halo ? 7 : 2.5}>
      {Array.from({ length: FLOW_BANDS }, (_, band) => <path key={band} d={FLOW_ROUTE}
        strokeDasharray="0 99999"
        strokeOpacity={Math.sin(Math.PI * (band + 0.5) / FLOW_BANDS) ** 2 * (halo ? 0.14 : 1)} />)}
    </g>)}
  </g>;
}

/** Decorative stars and a vector horizon with a softly pulsing stroke. */
export function HeroPlanetHorizon({ showHorizon = true }: { showHorizon?: boolean }) {
  const { ref, active } = useAmbientActivity();
  const [skyStars, setSkyStars] = useState(stars);
  const surfaceId = useId();
  const atmosphereId = useId();
  const edgeId = useId();
  const glowId = useId();
  const revealId = useId();
  const revealGradientId = useId();

  const repositionStar = (index: number) => {
    // Each cycle ends fully transparent, so changing position never jumps visibly.
    setSkyStars((current) => current.map((star, starIndex) => starIndex === index
      ? { ...star, left: `${2 + Math.random() * 96}%`, top: `${3 + Math.random() * 94}%` }
      : star));
  };

  return (
    <div ref={ref} className="hero-planet-field" data-ambient-active={active} aria-hidden="true">
      {showHorizon && (
        <svg className="hero-planet-rim" viewBox="0 0 1400 1100" preserveAspectRatio="none">
          <defs>
            <linearGradient id={revealGradientId}>
              <stop offset="0" stopColor="white" stopOpacity="0" />
              <stop offset="0.06" stopColor="white" />
              <stop offset="0.94" stopColor="white" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id={revealId} maskUnits="userSpaceOnUse" x="-120" y="-350" width="1640" height="1570">
              <rect className="hero-horizon-reveal" x="-120" y="-350" width="1640" height="1570"
                fill={`url(#${revealGradientId})`} />
            </mask>
            {[edgeId, glowId].map((id) => (
            <linearGradient key={id} id={id} className={id === edgeId ? "hero-planet-edge" : undefined} x1="0" y1="0" x2="1400" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="currentColor" stopOpacity="0" />
              <stop offset="0.14" stopColor="currentColor" stopOpacity="0.15" />
              <stop offset="0.35" stopColor="currentColor" stopOpacity="0.85" />
              <stop offset="0.5" stopColor="currentColor" />
              <stop offset="0.65" stopColor="currentColor" stopOpacity="0.85" />
              <stop offset="0.86" stopColor="currentColor" stopOpacity="0.15" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
            ))}
            <radialGradient id={atmosphereId}>
              <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.24" />
              <stop offset="0.42" stopColor="var(--color-primary)" stopOpacity="0.06" />
              <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={surfaceId} x1="0" y1="0" x2="0" y2="420" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="color-mix(in srgb, var(--color-primary) 8%, var(--color-canvas))" />
              <stop offset="0.65" stopColor="color-mix(in srgb, var(--color-primary) 1%, var(--color-canvas))" />
              <stop offset="1" stopColor="var(--color-canvas)" />
            </linearGradient>
          </defs>
          <g mask={`url(#${revealId})`}>
          <ellipse cx="700" cy="5" rx="550" ry="265" fill={`url(#${atmosphereId})`} />
          <g className="hero-planet-glow" fill="none" stroke={`url(#${glowId})`}>
            {horizonGlow.map(({ width, opacity }) => (
              <ellipse key={width} cx="700" cy="550" rx="700" ry="550"
                strokeWidth={width} strokeOpacity={opacity} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          {/* The opaque planet covers the inner halo, leaving the glow above
              the rim and only a faint shaded gradient beneath it. */}
          <ellipse cx="700" cy="550" rx="700" ry="550" fill={`url(#${surfaceId})`} />
          <path d={horizonEdge} fill={`url(#${edgeId})`} />
          <HorizonFlow active={active} />
          </g>
        </svg>
      )}
      <div className="hero-planet-stars">
        {skyStars.map((style, index) => (
          <span key={index} className="hero-planet-star" style={style} onAnimationIteration={() => repositionStar(index)} />
        ))}
      </div>
      <div className="hero-shooting-stars">
        {shootingStars.map((style, index) => (
          <span key={index} className="hero-shooting-star" style={style} />
        ))}
      </div>
      {!showHorizon && <div className="hero-planet-vignette" />}
    </div>
  );
}
