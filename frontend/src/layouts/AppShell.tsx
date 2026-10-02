import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Logo } from "../components/Logo";
import { MarketTape } from "../components/MarketTape";
import { WalletAuthButton } from "../components/WalletAuthButton";
import { useAuth } from "../providers/auth-context";

const standardNavItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Missions", to: "/missions" },
  { label: "Rankings", to: "/rankings" },
  { label: "Profile", to: "/profile" },
];

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const navItems =
    auth.user?.role === "ADMIN"
      ? [...standardNavItems, { label: "Admin", to: "/admin" }]
      : standardNavItems;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:px-8">
          <div className="justify-self-start"><Logo /></div>
          <nav
            className="order-3 col-span-2 flex w-full items-center gap-1 overflow-x-auto pt-2 lg:order-none lg:col-span-1 lg:w-auto lg:pt-0"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `focus-ring flex min-h-10 shrink-0 items-center rounded-md px-3 text-xs font-medium motion-safe:transition-colors motion-safe:duration-100 ${isActive ? "bg-primary/12 text-primary" : "text-muted hover:bg-surface hover:text-ink"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="shrink-0 justify-self-end">
            <WalletAuthButton />
          </div>
        </div>
        {location.pathname === "/" && <MarketTape />}
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Falcon command system</span>
          <span className="font-mono uppercase tracking-wider">
            Paper trading only
          </span>
        </div>
      </footer>
    </div>
  );
}
