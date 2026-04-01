import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import BottomTabs from './BottomTabs';
import MoreMenu from './MoreMenu';
import ErrorBoundary from '../ui/ErrorBoundary';
import { getPageTitle, primaryNavItems } from '../../navigation/nav';

export default function AppShell({
  email,
  onLogout,
}: {
  email: string | null;
  onLogout: () => void;
}) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreInvoker, setMoreInvoker] = useState<'top' | 'bottom'>('top');
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const bottomMoreButtonRef = useRef<HTMLButtonElement | null>(null);

  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);

  // Close overflow menu on navigation.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell">
      <header className="shell__topbar" aria-label="App">
        <div className="shell__topbar-inner">
          <div className="shell__brand" aria-label="Body Fat Tracker">
            <span className="shell__brand-name">Body Fat Tracker</span>
          </div>

          <div className="shell__context" aria-label="Page">
            <h1 className="shell__title">{pageTitle}</h1>
          </div>

          <nav className="shell__nav" aria-label="Primary">
            {primaryNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                {...(item.end ? { end: true } : {})}
                className={({ isActive }) => `shell__nav-link ${isActive ? 'shell__nav-link--active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="shell__actions">
            <button
              ref={moreButtonRef}
              type="button"
              className="shell__more-btn"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => {
                setMoreInvoker('top');
                setMoreOpen((v) => !v);
              }}
            >
              More
            </button>
            <MoreMenu
              open={moreOpen}
              onClose={() => setMoreOpen(false)}
              anchorRef={moreInvoker === 'bottom' ? bottomMoreButtonRef : moreButtonRef}
              email={email}
              onLogout={onLogout}
            />
          </div>
        </div>
      </header>

      <main className="shell__main" role="main">
        <ErrorBoundary title="Page error" key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <BottomTabs
        moreButtonRef={bottomMoreButtonRef}
        onOpenMore={() => {
          setMoreInvoker('bottom');
          setMoreOpen(true);
        }}
      />
    </div>
  );
}

