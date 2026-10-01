import { PageHeader } from '../components/PageHeader'
import { MissionsGrid } from '../features/missions/MissionsGrid'

export function MissionsPage() {
  return <div><PageHeader eyebrow="Command / Missions" title="Mission board" description="Review open operations, their market roster, and the virtual capital assigned to every operator." /><div className="mt-10"><MissionsGrid /></div></div>
}
