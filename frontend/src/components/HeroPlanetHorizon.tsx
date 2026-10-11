import "./HeroPlanetHorizon.css";
import { useState } from "react";
import type { CSSProperties } from "react";

// Deterministic positions keep the sky stable across renders and reloads.
const stars = Array.from({ length: 64 }, (_, index) => ({
  left: `${2 + ((index * 37 + 11) % 97)}%`,
  top: `${3 + ((index * 23 + 7) % 66)}%`,
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

/** A live CSS planet horizon, kept decorative so the hero stays accessible. */
export function HeroPlanetHorizon() {
  const [skyStars, setSkyStars] = useState(stars);

  const repositionStar = (index: number) => {
    // Each cycle ends fully transparent, so changing position never jumps visibly.
    setSkyStars((current) => current.map((star, starIndex) => starIndex === index
      ? { ...star, left: `${2 + Math.random() * 96}%`, top: `${3 + Math.random() * 66}%` }
      : star));
  };

  return (
    <div className="hero-planet-field" aria-hidden="true">
      <div className="hero-planet-stars">
        {skyStars.map((style, index) => (
          <span key={index} className="hero-planet-star" style={style} onAnimationIteration={() => repositionStar(index)} />
        ))}
      </div>
      <div className="hero-planet-atmosphere" />
      <div className="hero-planet-surface" />
      <div className="hero-planet-rim" />
      <div className="hero-shooting-stars">
        {shootingStars.map((style, index) => (
          <span key={index} className="hero-shooting-star" style={style} />
        ))}
      </div>
      <div className="hero-planet-vignette" />
    </div>
  );
}
