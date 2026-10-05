import type { MissionStatus } from '../../types/mission'

const activeStatuses: ReadonlySet<MissionStatus> = new Set(['REGISTRATION', 'ACTIVE', 'BLACKOUT'])

const statusLabels: Partial<Record<MissionStatus, string>> = {
  ACTIVE: 'Live',
  BLACKOUT: 'Live · blackout',
  REGISTRATION: 'Registration',
  LOCKED: 'Locked',
  FINALIZED: 'Finalized',
}

export function StatusBadge({ status }: { status: MissionStatus }) {
  const active = activeStatuses.has(status)
  return <span className={`inline-flex items-center gap-2 text-xs font-semibold ${active ? 'text-primary' : 'text-muted'}`}><span className={`size-1.5 rounded-full ${active ? 'bg-primary' : 'bg-muted'}`} aria-hidden="true" />{statusLabels[status] ?? status.replace('_', ' ').toLowerCase()}</span>
}
