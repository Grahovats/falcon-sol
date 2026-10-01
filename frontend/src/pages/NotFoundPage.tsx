import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <div className="py-20 text-center"><p className="font-mono text-xs uppercase tracking-wider text-primary">Signal 404</p><h1 className="mt-4 text-3xl font-semibold text-ink">Coordinate not found</h1><p className="mt-3 text-muted">This route is outside the current operation area.</p><Link to="/" className="focus-ring mt-6 inline-flex min-h-11 items-center text-primary">Return to command</Link></div>
}
