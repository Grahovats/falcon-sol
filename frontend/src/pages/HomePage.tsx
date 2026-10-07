import {
  ArrowRight,
  Crosshair,
  Radio,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
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

      <ScrollReveal direction="right">
        <section
          className="section-signal-host relative isolate border-t border-line py-16 sm:py-20"
          aria-label="Falcon platform summary"
        >
          <SectionSignalField side="right" wide />
          <div className="relative z-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">
                  Operational integrity
                </p>
                <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">
                  Every operator faces the same clock, capital, and market.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted lg:justify-self-end">
                Falcon isolates decision quality from wallet size. Missions create a
                controlled arena where execution and risk management determine the
                result.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <PlatformStat
                number="01"
                icon={<Radio />}
                label="Live operations"
                value="Time-boxed"
                detail="Every mission has a defined market and finish line."
              />
              <PlatformStat
                number="02"
                icon={<Crosshair />}
                label="Execution"
                value="Market-aware"
                detail="Paper fills follow current pricing and route conditions."
              />
              <PlatformStat
                number="03"
                icon={<Trophy />}
                label="Performance"
                value="Verifiable"
                detail="Final equity determines the command board."
              />
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal direction="up">
        <section
          className="relative mb-8 grid overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[1fr_auto]"
          aria-labelledby="final-cta-title"
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_right,var(--color-primary),transparent_68%)] opacity-[0.08]"
            aria-hidden="true"
          />
          <div className="relative px-6 py-10 sm:px-10 sm:py-12">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">
              Your record starts here
            </p>
            <h2
              id="final-cta-title"
              className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl"
            >
              Put your strategy where the scoreboard can see it.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
              Connect a wallet to establish your participant identity. All trades
              use virtual capital—no deposits, no real swaps.
            </p>
          </div>
          <div className="relative flex items-center border-t border-line px-6 py-6 sm:px-10 lg:border-l lg:border-t-0">
            <Link
              to="/missions"
              className="directional-action focus-ring inline-flex min-h-14 w-full items-center justify-between gap-8 rounded-md bg-primary px-6 text-sm font-semibold text-primary-ink lg:w-auto"
            >
              Browse missions{" "}
              <ArrowRight className="action-icon size-4" aria-hidden="true" />
            </Link>
          </div>
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
    <article className="group relative min-h-64 overflow-hidden rounded-lg border border-line bg-surface p-6 motion-safe:transition-colors motion-safe:duration-150 hover:border-line-strong sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-11 items-center justify-center rounded-md border border-line bg-canvas text-primary [&>svg]:size-5">
          {icon}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted">{number}</span>
      </div>
      <div className="mt-12">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">
          {label}
        </p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          {value}
        </p>
        <p className="mt-3 max-w-xs text-sm leading-6 text-muted">{detail}</p>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-primary motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-x-100" aria-hidden="true" />
    </article>
  );
}
