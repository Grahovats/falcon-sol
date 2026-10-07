import {
  ArrowRight,
  Crosshair,
  Radio,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { GlassPanel } from "../components/GlassPanel";
import { HowItWorks } from "../components/HowItWorks";
import { HeroSignalField } from "../components/HeroSignalField";
import { ScrollChargeDivider } from "../components/ScrollChargeDivider";
import { ScrollReveal } from "../components/ScrollReveal";
import { SectionSignalField } from "../components/SectionSignalField";

export function HomePage() {
  return (
    <div className="pb-8">
      <section className="falcon-hero">
        <HeroSignalField />
        <div className="falcon-hero-copy relative z-10">
          <h1 className="flex flex-col gap-[0.1em] text-[clamp(3.25rem,7.5vw,7.5rem)] font-semibold leading-none tracking-[-0.055em] text-ink">
            <span className="block">Trade the signal.</span>
            <span className="block text-primary">Prove the edge.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-muted sm:mt-10 sm:text-xl sm:leading-9 lg:text-2xl lg:leading-10">
            Enter time-boxed meme-coin missions with equal virtual capital.
            Build your strategy, execute against live market data, and earn your
            position on the command board.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4 sm:mt-10">
            <Link
              to="/missions"
              className="directional-action focus-ring inline-flex min-h-14 items-center gap-3 rounded-sm bg-primary px-8 text-base font-semibold text-primary-ink motion-safe:transition-colors motion-safe:duration-100 hover:bg-primary-strong active:translate-y-px"
            >
              Enter the arena{" "}
              <ArrowRight className="action-icon size-5" aria-hidden="true" />
            </Link>
            <Link
              to="/rankings"
              className="focus-ring inline-flex min-h-14 items-center gap-3 rounded-sm px-6 text-base font-semibold text-muted motion-safe:transition-colors motion-safe:duration-100 hover:text-primary"
            >
              View rankings
            </Link>
          </div>
          <dl className="mt-12 grid max-w-3xl grid-cols-3 divide-x divide-line py-5 sm:mt-16">
            <HeroMetric label="Starting capital" value="$10K" />
            <HeroMetric label="Real assets" value="$0" />
            <HeroMetric label="Skill signal" value="100%" />
          </dl>
        </div>
      </section>

      <ScrollChargeDivider />
      <ScrollReveal direction="up" edge={false}>
        <HowItWorks />
      </ScrollReveal>

      <ScrollReveal direction="up" edge={false}>
        <section className="home-integrity-section py-16 sm:py-20" aria-labelledby="integrity-title">
          <div className="home-section-background" aria-hidden="true"><SectionSignalField side="right" wide /></div>
          <div className="home-section-heading">
            <div>
              <p className="home-section-eyebrow">Operational integrity</p>
              <h2 id="integrity-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
                Equal conditions.<br /><span className="text-primary">A clear result.</span>
              </h2>
            </div>
            <p className="max-w-md text-base leading-8 text-muted">
              Same clock. Same capital. Same market. Falcon gives every operator
              a controlled arena where execution and risk management decide the result.
            </p>
          </div>
          <div className="home-integrity-grid mt-10 sm:mt-14">
            <PlatformStat number="01" icon={<Radio />} label="Live operations" value="Time boxed" detail="Every mission has a defined market and finish line. You always know the clock you're trading against." />
            <PlatformStat number="02" icon={<Crosshair />} label="Execution" value="Market aware" detail="Paper fills follow current pricing and route conditions. Every decision meets the same market." />
            <PlatformStat number="03" icon={<Trophy />} label="Performance" value="Verifiable" detail="Final equity determines the command board. Your rank reflects the result you earned." />
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal direction="up" edge={false}>
        <section className="home-final-section py-12 sm:py-16" aria-labelledby="final-cta-title">
          <div className="home-section-background" aria-hidden="true"><SectionSignalField side="left" wide /></div>
          <GlassPanel className="home-final-panel" interactive={false}>
            <p className="home-section-eyebrow">Your record starts here</p>
            <h2 id="final-cta-title" className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Your next move.<br /><span className="text-primary">Your first mission.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-muted sm:text-lg">
              Put your strategy where the scoreboard can see it.
              Connect a wallet, choose your mission, and trade with virtual capital.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10 sm:gap-5">
              <Link to="/missions" className="directional-action focus-ring inline-flex min-h-14 items-center gap-3 rounded-sm bg-primary px-8 text-base font-semibold text-primary-ink motion-safe:transition-colors motion-safe:duration-100 hover:bg-primary-strong">
                Enter the arena<ArrowRight className="action-icon size-5" aria-hidden="true" />
              </Link>
              <Link to="/rankings" className="focus-ring inline-flex min-h-14 items-center gap-2 rounded-sm px-6 text-base font-semibold text-muted motion-safe:transition-colors motion-safe:duration-100 hover:text-primary">
                View rankings<ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-8 text-sm text-muted">Equal virtual capital. No deposits. No real swaps.</p>
          </GlassPanel>
        </section>
      </ScrollReveal>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 first:pl-0 last:pr-0 sm:px-8">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:text-xs">
        {label}
      </dt>
      <dd className="mt-3 font-mono text-2xl tabular-nums text-ink sm:text-3xl">
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
    <GlassPanel className="home-integrity-card">
      <div className="flex items-start justify-between gap-4">
        <p className="journey-eyebrow"><span className="journey-number">{number}</span>{label}</p>
        <span className="shrink-0 text-primary [&>svg]:size-5 [&>svg]:stroke-[1.5]" aria-hidden="true">{icon}</span>
      </div>
      <h3 className="mt-8 text-3xl font-semibold tracking-tight text-ink md:text-2xl xl:text-3xl">{value}</h3>
      <p className="mt-4 max-w-sm text-base leading-7 text-muted">{detail}</p>
    </GlassPanel>
  );
}
