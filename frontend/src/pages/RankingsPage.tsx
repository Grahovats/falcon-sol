import { PageHeader } from '../components/PageHeader'
import { PlaceholderPanel } from '../components/PlaceholderPanel'

export function RankingsPage() {
  return <div><PageHeader eyebrow="Command board" title="Rankings" description="Mission performance will be ranked here after the trading and PnL systems are online." /><div className="mt-10"><PlaceholderPanel label="Awaiting telemetry" title="No ranked operators yet"><p>Rankings activate when a mission begins recording paper trades.</p></PlaceholderPanel></div></div>
}
