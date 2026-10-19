import {
  ArrowDown,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { ArenaTicket } from "../components/ArenaTicket";
import { HowItWorks } from "../components/HowItWorks";
import { HeroPlanetHorizon } from "../components/HeroPlanetHorizon";
import { HomeAtmosphere } from "../components/HomeAtmosphere";
import { ScrollChargeDivider } from "../components/ScrollChargeDivider";
import { ScrollReveal } from "../components/ScrollReveal";

/* Closing-section entrance: heading first, cards at 90ms intervals;
 * the final panel follows with its copy and actions. Each reveals once. */
const CLOSING_REVEAL_TIMING = { cardStaggerMs: 90 } as const;

/* HERO ENTRANCE
 *   0ms  first headline lifts into view; actions stay usable
 *  160ms second headline follows
 *  320ms the horizon begins drawing
 */
const HERO_TIMING = { headlineMs: 160, descriptionMs: 320 } as const;
const heroEntranceStyle = {
  "--hero-headline-delay": `${HERO_TIMING.headlineMs}ms`,
  "--hero-description-delay": `${HERO_TIMING.descriptionMs}ms`,
} as CSSProperties;

export function HomePage() {
  return (
    <div>
      <section className="falcon-hero" style={heroEntranceStyle}>
        <HeroPlanetHorizon />
        <div className="falcon-hero-copy relative z-10">
          <h1 className="falcon-hero-title text-ink">
            <span className="hero-title-line block"><span className="hero-title-reveal block">The market moves.</span></span>
            <span className="hero-title-line block text-primary"><span className="hero-title-reveal block">Make your mark.</span></span>
          </h1>
          <div className="hero-actions">
            <Link
              to="/missions"
              className="hero-enter-action directional-action focus-ring"
            >
              <span>Find your mission</span>
              <ArrowRight className="action-icon size-5" aria-hidden="true" />
            </Link>
            <a
              href="#how-falcon-works"
              className="hero-learn-action focus-ring"
              onClick={(event) => {
                const section = document.getElementById("how-falcon-works");
                if (!section) return;
                event.preventDefault();
                section.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
                  block: "start",
                });
              }}
            >
              Learn more <ArrowDown size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
        <p className="hero-horizon-caption">Virtual capital. Live markets. Cash prizes.</p>
      </section>

      <ScrollChargeDivider />
      <div className="home-below-hero">
        <HomeAtmosphere />
        <div id="how-falcon-works" className="home-learn-target">
          <ScrollReveal direction="up" edge={false}>
            <HowItWorks />
          </ScrollReveal>
        </div>

        <section className="home-integrity-section py-16 sm:py-20" aria-labelledby="integrity-title">
          <ScrollReveal edge={false} className="home-section-heading home-scroll-reveal">
            <h2 id="integrity-title" className="home-section-eyebrow">Operational integrity</h2>
          </ScrollReveal>
          <div className="home-integrity-grid mt-10 sm:mt-14">
            <PlatformStat number="01" value="Time boxed" detail="Every mission has a defined market and finish line. You always know the clock you're trading against." />
            <PlatformStat number="02" value="Market aware" detail="Paper fills follow current pricing and route conditions. Every decision meets the same market." />
            <PlatformStat number="03" value="Verifiable" detail="Final equity determines the command board. Your rank reflects the result you earned." />
          </div>
        </section>

        <ScrollReveal direction="up" edge={false} className="home-scroll-reveal">
          <section className="home-final-section pb-6 pt-12 sm:pb-8 sm:pt-16" aria-labelledby="final-cta-title">
            <ArenaTicket />
          </section>
        </ScrollReveal>
      </div>
    </div>
  );
}

function PlatformStat({
  number,
  value,
  detail,
}: {
  number: string;
  value: string;
  detail: string;
}) {
  return (
    <ScrollReveal edge={false} className="home-integrity-card home-scroll-reveal" delayMs={(Number(number) - 1) * CLOSING_REVEAL_TIMING.cardStaggerMs}>
      <article className="integrity-instrument">
        <span className="integrity-instrument-number" aria-hidden="true">{number}</span>
        <div className="integrity-instrument-copy">
          <h3>{value}</h3>
          <p>{detail}</p>
        </div>
      </article>
    </ScrollReveal>
  );
}
