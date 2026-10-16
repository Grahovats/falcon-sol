import { MissionsGrid } from '../features/missions/MissionsGrid'
import './MissionsPage.css'
import './MissionsLanding.css'

export function MissionsPage() {
  return <div className="missions-page"><MissionsGrid singleMission /></div>
}
