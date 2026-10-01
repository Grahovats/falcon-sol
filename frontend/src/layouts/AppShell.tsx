import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { WalletAuthButton } from '../components/WalletAuthButton'
import { useAuth } from '../providers/auth-context'

const standardNavItems = [
  { label: 'Missions', to: '/missions' },
  { label: 'Rankings', to: '/rankings' },
  { label: 'Profile', to: '/profile' },
]

export function AppShell() {
  const auth = useAuth()
  const navItems = auth.user?.role === 'ADMIN' ? [...standardNavItems, { label: 'Admin', to: '/admin' }] : standardNavItems
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 px-4 py-3 sm:px-6 lg:px-8">
          <Logo />
          <WalletAuthButton />
          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto pt-3 sm:order-2 sm:w-auto sm:pt-0" aria-label="Primary navigation">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `focus-ring flex min-h-10 shrink-0 items-center rounded-sm px-3 text-sm font-medium ${isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:text-ink'}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><Outlet /></main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Falcon command system</span><span className="font-mono uppercase tracking-wider">Paper trading only</span>
        </div>
      </footer>
    </div>
  )
}
