import { MissionsGrid } from '../features/missions/MissionsGrid'

export function MissionsPage() {
  return <div><header><p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Mission control</p><h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">Live missions</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Deploy virtual capital, trade the active roster, and climb the command board.</p></header><div className="mt-8"><MissionsGrid /></div></div>
}
