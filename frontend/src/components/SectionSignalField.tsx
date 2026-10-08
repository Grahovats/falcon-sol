/** Decorative signal paths for secondary home sections. */
export function SectionSignalField({
  side = "left",
  wide = false,
  stretch = false,
}: {
  side?: "left" | "right";
  wide?: boolean;
  stretch?: boolean;
}) {
  return (
    <div
      className={`section-signal-field section-signal-field-${side}${wide ? " section-signal-field-wide" : ""}`}
      aria-hidden="true"
    >
      <svg
        className="section-signal-map"
        viewBox="0 0 900 600"
        preserveAspectRatio={stretch ? "none" : "xMinYMid slice"}
      >
        <g className="section-signal-contours">
          <path d="M-120 548C86 520 162 366 334 346S582 174 928 222" />
          <path d="M-120 430C88 404 188 250 372 238S654 94 950 152" />
          <path d="M-100 594C130 566 250 450 420 426S692 296 960 322" />
        </g>

        <g className="section-signal-routes">
          <path d="M-120 506C82 488 166 338 342 326S602 154 946 204" />
          <path d="M-100 386C110 368 202 226 386 218S670 86 958 136" />
          <path
            className="section-signal-flow"
            pathLength="1"
            d="M-120 506C82 488 166 338 342 326S602 154 946 204"
          />
          <path
            className="section-signal-flow section-signal-flow-secondary"
            pathLength="1"
            d="M-100 386C110 368 202 226 386 218S670 86 958 136"
          />
        </g>
      </svg>
      <div className="section-signal-vignette" />
    </div>
  );
}
