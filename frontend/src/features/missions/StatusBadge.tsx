import type { MissionStatus } from '../../types/mission'

const activeStatuses: ReadonlySet<MissionStatus> = new Set(['REGISTRATION', 'ACTIVE'])

export function StatusBadge({ status }: { status: MissionStatus }) {
  const active = activeStatuses.has(status)
  return <span className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider ${active ? 'text-primary' : 'text-muted'}`}><span className={`size-1.5 rounded-full ${active ? 'bg-primary' : 'bg-muted'}`} aria-hidden="true" />{status.replace('_', ' ')}</span>
}
