import { ShieldOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthenticationRequired } from './AuthenticationRequired'
import { useAuth } from '../providers/auth-context'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  if (auth.status === 'loading' || auth.status === 'signing') return <div className="h-80 animate-pulse border border-line bg-surface" aria-busy="true" aria-label="Verifying administrator access" />
  if (auth.status !== 'authenticated') return <AuthenticationRequired title="Authenticate for mission control" />
  if (auth.user?.role !== 'ADMIN') {
    return <section className="mx-auto max-w-2xl border border-danger/40 bg-danger/5 p-6 sm:p-8" role="alert"><ShieldOff className="size-7 text-danger" aria-hidden="true" /><h1 className="mt-5 text-2xl font-semibold text-ink">Admin wallet required</h1><p className="mt-2 text-sm leading-6 text-muted">This operator is authenticated but is not on Falcon’s approved administrator wallet list.</p><Link to="/missions" className="focus-ring mt-6 inline-flex min-h-11 items-center border border-line px-4 text-sm text-ink hover:border-primary">Return to missions</Link></section>
  }
  return children
}
