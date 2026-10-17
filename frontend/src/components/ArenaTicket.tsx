import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TicketSurface } from './TicketSurface'
import './ArenaTicket.css'

export function ArenaTicket() {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const active = hovered || focused

  return <div className="home-final-panel" data-ticket-active={active}
    onPointerEnter={event => { if (event.pointerType === 'mouse' || event.pointerType === 'pen') setHovered(true) }}
    onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <div className="home-final-copy">
      <p data-scroll-reveal-item="1" className="home-final-question">Falcon / Arena pass</p>
      <h2 data-scroll-reveal-item="2" id="final-cta-title">Admit one.<br />Make it count.</h2>
    </div>
    <dl data-scroll-reveal-item="3" className="home-final-ticket-details">
      <div><dt>Starting capital</dt><dd>$10,000 <span>virtual</span></dd></div>
      <div><dt>Your assignment</dt><dd>Climb the board.</dd></div>
    </dl>
    <TicketSurface className="home-final-actions" active={active}>
      <Link to="/missions" className="focus-ring home-final-enter">
        <span data-scroll-reveal-item="4" className="home-final-stub-copy">
          <span className="home-final-print">
            <span className="home-final-ticket-label">Choose your mission</span>
            <span className="home-final-ticket-action">I’m in.</span>
          </span>
        </span>
      </Link>
    </TicketSurface>
  </div>
}
