import { MissionsGrid } from "../features/missions/MissionsGrid";
import { SectionSignalField } from "../components/SectionSignalField";

export function MissionsPage() {
  return (
    <div>
      <header className="relative isolate border-b border-line py-10 sm:py-12">
        <SectionSignalField side="right" wide />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              Missions
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-ink sm:text-5xl">
              Choose your <span className="text-primary">mission.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              Join time-limited trading missions with equal virtual capital.
              Same rules. Real market data. Prove your edge.
            </p>
          </div>

          <div className="hidden justify-self-end rounded-md border border-line bg-canvas/70 px-5 py-4 backdrop-blur-sm lg:block">
            <p className="font-mono text-[10px] uppercase leading-5 tracking-[0.12em] text-primary">
              Different markets.<br />Same skill.<br />Higher rank.
            </p>
          </div>
        </div>
      </header>

      <div className="mt-5">
        <MissionsGrid />
      </div>
    </div>
  );
}
