import { AnimatePresence, LazyMotion, m, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { NavLink, useLocation, useOutlet } from "react-router-dom";
import { SectionSignalField } from "../components/SectionSignalField";
import { Logo } from "../components/Logo";
import { MarketTape } from "../components/MarketTape";
import { WalletAuthButton } from "../components/WalletAuthButton";
import { useAuth } from "../providers/auth-context";

const standardNavItems = [
  { label: "Home", to: "/" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "Missions", to: "/missions" },
  { label: "Rankings", to: "/rankings" },
  { label: "Profile", to: "/profile" },
];

/* ─────────────────────────────────────────────────────────
 * ROUTE CONTENT STORYBOARD
 *
 * Static shell (header, navigation, wallet) never re-animates.
 * Only route content enters after navigation / refresh.
 *
 *    0ms   outgoing route starts a short fade
 *  120ms   outgoing route clears as the incoming route overlaps
 *  240ms   incoming route settles 6px into place
 * ───────────────────────────────────────────────────────── */
const ROUTE_TIMING = {
  exitDurationMs: 120,
  fadeDurationMs: 200,
} as const;

const ROUTE_MOTION = {
  offsetY: 6,
  spring: { type: "spring" as const, stiffness: 420, damping: 38, mass: 0.8 },
  easeOut: [0, 0, 0.2, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
};

const loadMotionFeatures = () => import("../lib/motion-features").then((module) => module.default);

export function AppShell() {
  const headerRef = useRef<HTMLElement>(null);
  const auth = useAuth();
  const location = useLocation();
  const outlet = useOutlet();
  const isTradingPage = /^\/missions\/[^/]+$/.test(location.pathname);
  const pageGutters = isTradingPage ? "px-3 sm:px-4" : "px-4 sm:px-6 lg:px-8";
  const reduceMotion = useReducedMotion();
  const navItems =
    auth.user?.role === "ADMIN"
      ? [...standardNavItems, { label: "Admin", to: "/admin" }]
      : standardNavItems;

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const syncHeaderHeight = () => {
      document.documentElement.style.setProperty(
        "--app-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    };
    const observer = new ResizeObserver(syncHeaderHeight);
    syncHeaderHeight();
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-shell min-h-screen">
      <header ref={headerRef} className={`sticky top-0 z-40 bg-canvas/90 backdrop-blur-xl ${location.pathname === "/" ? "" : "border-b border-line"}`}>
        <div className={`grid w-full min-w-0 grid-cols-[auto_1fr] items-center gap-x-4 py-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-5 ${pageGutters}`}>
          <div className="justify-self-start"><Logo /></div>
          <nav
            className="primary-nav order-3 col-span-2 flex w-full items-center gap-1 overflow-x-auto overflow-y-hidden pt-2 lg:order-none lg:col-span-1 lg:w-auto lg:justify-self-start lg:pt-0"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-link focus-ring flex min-h-11 shrink-0 items-center px-3 text-sm font-semibold ${isActive ? "nav-link-active text-primary" : "text-muted hover:text-primary"}`
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
      <main className={`app-main grid w-full min-w-0 [&>*]:col-start-1 [&>*]:row-start-1 ${pageGutters}`}>
        <LazyMotion features={loadMotionFeatures}>
          <AnimatePresence initial={false}>
            <m.div
              key={location.pathname}
              className={`route-content min-w-0 ${location.pathname === "/" ? "" : `app-page-content${isTradingPage ? " app-page-content-terminal" : ""}`} ${location.pathname === "/" ? "pt-0" : isTradingPage ? "py-3" : "py-8 sm:py-10"}`}
              initial={reduceMotion ? false : { opacity: 0, y: ROUTE_MOTION.offsetY }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -2, transition: { duration: ROUTE_TIMING.exitDurationMs / 1000, ease: ROUTE_MOTION.easeIn } }}
              transition={reduceMotion ? { duration: 0 } : {
                opacity: { duration: ROUTE_TIMING.fadeDurationMs / 1000, ease: ROUTE_MOTION.easeOut },
                y: ROUTE_MOTION.spring,
              }}
            >
              {location.pathname !== "/" && <div className="app-page-background" aria-hidden="true"><SectionSignalField side="right" wide stretch /></div>}
              {outlet}
            </m.div>
          </AnimatePresence>
        </LazyMotion>
      </main>
    </div>
  );
}
