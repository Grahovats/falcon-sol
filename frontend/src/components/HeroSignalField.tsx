/** Decorative ambient telemetry for the home hero. */
export function HeroSignalField() {
  return (
    <div className="hero-signal-field" aria-hidden="true">
      <div className="hero-signal-grid" />
      <div className="hero-signal-glow" />
      <svg
        className="hero-signal-map"
        viewBox="0 0 1600 800"
        preserveAspectRatio="xMaxYMid slice"
      >
        <defs>
          <linearGradient id="signal-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="0.42" stopColor="currentColor" stopOpacity="0.15" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.65" />
          </linearGradient>
        </defs>

        <g className="hero-signal-contours">
          <path d="M700 800C706 566 890 368 1118 324c206-40 393 45 482 168" />
          <path d="M844 800c5-174 139-320 306-352 178-35 345 42 450 176" />
          <path d="M1002 800c3-105 83-194 185-214 117-23 232 28 299 124" />
          <circle cx="1320" cy="142" r="250" />
          <circle cx="1320" cy="142" r="174" />
        </g>

        <g className="hero-signal-routes">
          <path
            className="hero-signal-route"
            d="M532 654C710 644 730 548 858 510s206-42 310-94 170-154 432-190"
          />
          <path
            className="hero-signal-route hero-signal-route-muted"
            d="M476 584c170-62 272-38 392-92 128-58 151-155 286-184 139-30 224 46 446-32"
          />
          <path
            className="hero-signal-flow hero-signal-flow-primary"
            pathLength="1"
            d="M532 654C710 644 730 548 858 510s206-42 310-94 170-154 432-190"
          />
          <path
            className="hero-signal-flow hero-signal-flow-secondary"
            pathLength="1"
            d="M476 584c170-62 272-38 392-92 128-58 151-155 286-184 139-30 224 46 446-32"
          />
        </g>

      </svg>
      <div className="hero-signal-vignette" />
    </div>
  );
}
