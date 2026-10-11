import {
  ArrowRight,
  Crosshair,
  Radio,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { GlassPanel } from "../components/GlassPanel";
import { HowItWorks } from "../components/HowItWorks";
import { HeroPlanetHorizon } from "../components/HeroPlanetHorizon";
import { ScrollChargeDivider } from "../components/ScrollChargeDivider";
import { ScrollReveal } from "../components/ScrollReveal";
import { SectionSignalField } from "../components/SectionSignalField";

/* Closing-section entrance: heading first, cards at 90ms intervals;
 * the final panel follows with its copy and actions. Each reveals once. */
const CLOSING_REVEAL_TIMING = { cardStaggerMs: 90 } as const;

/* HERO ENTRANCE
 *   0ms  first headline lifts into view; actions stay usable
 *  160ms second headline follows
 *  320ms supporting copy settles; the horizon begins drawing
 *  512ms metrics arrive from left to right (112ms intervals)
 */
const HERO_TIMING = { headlineMs: 160, descriptionMs: 320, metricsMs: 512, metricStaggerMs: 112 } as const;
const heroEntranceStyle = {
  "--hero-headline-delay": `${HERO_TIMING.headlineMs}ms`,
  "--hero-description-delay": `${HERO_TIMING.descriptionMs}ms`,
  "--hero-metrics-delay": `${HERO_TIMING.metricsMs}ms`,
  "--hero-metric-stagger": `${HERO_TIMING.metricStaggerMs}ms`,
} as CSSProperties;

export function HomePage() {
  return (
    <div>
      <section className="falcon-hero" style={heroEntranceStyle}>
        <HeroPlanetHorizon />
        <div className="falcon-hero-copy relative z-10">
          <h1 className="flex flex-col gap-[0.1em] text-[clamp(2.5rem,5vw,5rem)] font-semibold leading-none tracking-[-0.055em] text-ink">
            <span className="hero-title-line block"><span className="hero-title-reveal block">The market moves.</span></span>
            <span className="hero-title-line block text-primary"><span className="hero-title-reveal block">Make your mark.</span></span>
          </h1>
          <p className="hero-description mx-auto mt-8 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Trade live Solana markets with $10,000 in virtual capital.
            Compete in timed missions, climb the leaderboard, and earn rewards in prize missions.
          </p>
          <div className="hero-actions mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/missions"
              className="directional-action focus-ring inline-flex min-h-14 items-center gap-3 rounded-sm bg-primary px-8 text-base font-semibold text-primary-ink motion-safe:transition-colors motion-safe:duration-100 hover:bg-primary-strong active:translate-y-px"
            >
              Explore missions{" "}
              <ArrowRight className="action-icon size-5" aria-hidden="true" />
            </Link>
            <Link
              to="/rankings"
              className="focus-ring inline-flex min-h-14 items-center gap-3 rounded-sm px-6 text-base font-semibold text-muted motion-safe:transition-colors motion-safe:duration-100 hover:text-primary"
            >
              View rankings
            </Link>
          </div>
        </div>
        <dl className="hero-metrics z-10 grid grid-cols-3 divide-x divide-line py-5">
          <HeroMetric label="Same clock" value="One deadline" />
          <HeroMetric label="Same capital" value="$10,000 each" />
          <HeroMetric label="Prove your skill" value="Compete for cash prizes" />
        </dl>
      </section>

      <ScrollChargeDivider />
      <ScrollReveal direction="up" edge={false}>
        <HowItWorks />
      </ScrollReveal>

      <section className="home-integrity-section py-16 sm:py-20" aria-labelledby="integrity-title">
        <div className="home-section-background" aria-hidden="true"><SectionSignalField side="right" wide /></div>
        <ScrollReveal edge={false} className="home-section-heading home-scroll-reveal">
          <h2 id="integrity-title" className="home-section-eyebrow">Operational integrity</h2>
        </ScrollReveal>
        <div className="home-integrity-grid mt-10 sm:mt-14">
          <PlatformStat number="01" icon={<Radio />} label="Live operations" value="Time boxed" detail="Every mission has a defined market and finish line. You always know the clock you're trading against." />
          <PlatformStat number="02" icon={<Crosshair />} label="Execution" value="Market aware" detail="Paper fills follow current pricing and route conditions. Every decision meets the same market." />
          <PlatformStat number="03" icon={<Trophy />} label="Performance" value="Verifiable" detail="Final equity determines the command board. Your rank reflects the result you earned." />
        </div>
      </section>

      <ScrollReveal direction="up" edge={false} stagger className="home-scroll-reveal">
        <section className="home-final-section pb-6 pt-12 sm:pb-8 sm:pt-16" aria-labelledby="final-cta-title">
          <div className="home-section-background" aria-hidden="true"><SectionSignalField side="left" wide /></div>
          <GlassPanel className="home-final-panel" interactive={false}>
            <p data-scroll-reveal-item="1" className="home-section-eyebrow">Your record starts here</p>
            <h2 data-scroll-reveal-item="2" id="final-cta-title" className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Your next move.<br /><span className="text-primary">Your first mission.</span>
            </h2>
            <p data-scroll-reveal-item="3" className="mx-auto mt-6 max-w-xl text-base leading-8 text-muted sm:text-lg">
              Put your strategy where the scoreboard can see it.
              Connect a wallet, choose your mission, and trade with virtual capital.
            </p>
            <div data-scroll-reveal-item="4" className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10 sm:gap-5">
              <Link to="/missions" className="directional-action focus-ring inline-flex min-h-14 items-center gap-3 rounded-sm bg-primary px-8 text-base font-semibold text-primary-ink motion-safe:transition-colors motion-safe:duration-100 hover:bg-primary-strong">
                Enter the arena<ArrowRight className="action-icon size-5" aria-hidden="true" />
              </Link>
              <Link to="/rankings" className="focus-ring inline-flex min-h-14 items-center gap-2 rounded-sm px-6 text-base font-semibold text-muted motion-safe:transition-colors motion-safe:duration-100 hover:text-primary">
                View rankings<ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <p data-scroll-reveal-item="5" className="mt-8 text-sm text-muted">Equal virtual capital. No deposits. No real swaps.</p>
          </GlassPanel>
        </section>
      </ScrollReveal>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 text-center sm:px-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:text-xs">
        {label}
      </dt>
      <dd className="mt-3 font-mono text-base tabular-nums text-ink sm:text-xl">
        {value}
      </dd>
    </div>
  );
}

function PlatformStat({
  number,
  icon,
  label,
  value,
  detail,
}: {
  number: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <ScrollReveal edge={false} className="home-integrity-card home-scroll-reveal" delayMs={(Number(number) - 1) * CLOSING_REVEAL_TIMING.cardStaggerMs}>
      <GlassPanel>
        <div className="flex items-start justify-between gap-4">
          <p className="journey-eyebrow"><span className="journey-number">{number}</span>{label}</p>
          <span className="shrink-0 text-primary [&>svg]:size-5 [&>svg]:stroke-[1.5]" aria-hidden="true">{icon}</span>
        </div>
        <h3 className="mt-8 text-3xl font-semibold tracking-tight text-ink md:text-2xl xl:text-3xl">{value}</h3>
        <p className="mt-4 max-w-sm text-base leading-7 text-muted">{detail}</p>
      </GlassPanel>
    </ScrollReveal>
  );
}
