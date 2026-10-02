import { MissionsGrid } from '../features/missions/MissionsGrid'

export function MissionsPage() {
  return <div><header><h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">Active missions</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Choose an operation, review the market roster, and deploy with equal virtual capital.</p></header><div className="mt-7"><MissionsGrid /></div></div>
}
