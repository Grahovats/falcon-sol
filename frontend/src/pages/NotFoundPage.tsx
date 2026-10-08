import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <section className="app-surface mx-auto my-10 max-w-3xl px-6 py-16 text-center sm:px-12 sm:py-20">
    <p className="mb-5 text-xs font-medium uppercase tracking-widest text-primary">404 · Outside the arena</p>
    <h1 className="text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">Coordinate not found<span className="text-primary">.</span></h1>
    <p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted">This route is outside the current operation area. Head back and choose your next move.</p>
    <Link to="/" className="app-button directional-action focus-ring mt-8 inline-flex min-h-14 items-center gap-3 bg-primary px-8 font-semibold text-primary-ink">Return to command<ArrowRight className="action-icon size-5" aria-hidden="true" /></Link>
  </section>
}
