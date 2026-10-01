import { Link } from 'react-router-dom'

export function Logo() {
  return (
    <Link to="/" className="focus-ring flex min-h-11 items-center gap-3 rounded-sm" aria-label="Falcon home">
      <span className="relative grid size-8 place-items-center border border-primary/70" aria-hidden="true"><span className="size-2 rotate-45 bg-primary" /></span>
      <span className="text-base font-semibold tracking-[0.24em] text-ink">FALCON</span>
    </Link>
  )
}
