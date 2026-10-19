import { Link } from 'react-router-dom'
import { TicketSurface } from './TicketSurface'
import './ArenaTicket.css'

export function ArenaTicket() {
  return <div className="home-final-panel">
    <div className="home-final-copy">
      <h2 id="final-cta-title">Admit one.<br />Make it count.</h2>
    </div>
    <dl className="home-final-ticket-details">
      <div><dt>Starting capital</dt><dd>$10,000 <span>virtual</span></dd></div>
      <div><dt>Your assignment</dt><dd>Climb the board.</dd></div>
    </dl>
    <TicketSurface className="home-final-actions" shading={false}>
      <Link to="/missions" className="focus-ring home-final-enter">
        <span className="home-final-stub-copy">
          <span className="home-final-print">
            <span className="home-final-ticket-label">Choose your mission</span>
            <span className="home-final-ticket-action">I’m in.</span>
          </span>
        </span>
      </Link>
    </TicketSurface>
  </div>
}
