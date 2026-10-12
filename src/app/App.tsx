import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from '../features/events/Home';
import { EventPage } from '../features/events/EventPage';
import { EditPage } from '../features/availability/EditPage';
import { Discover } from '../features/suggestions/Discover';
import { History } from '../features/history/History';
import { Admin } from '../features/admin/Admin';
import { DesignSystem } from '../features/events/DesignSystem';

const nav = [
  { to: '/', label: 'Home', end: true },
  { to: '/ontdek', label: 'Ontdek' },
  { to: '/geschiedenis', label: 'Geschiedenis' },
];

function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-5 py-24">
      <h1 className="h-section">Deze pagina bestaat niet.</h1>
      <NavLink to="/" className="btn mt-6">
        Terug naar home
      </NavLink>
    </main>
  );
}

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a
        href="#main"
        onClick={(e) => {
          // HashRouter gebruikt het fragment voor routes; een ankerlink zou naar een 404 navigeren.
          e.preventDefault();
          const main = document.getElementById('main');
          main?.setAttribute('tabindex', '-1');
          main?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-coral focus:px-4 focus:py-2 focus:text-night"
      >
        Naar inhoud
      </a>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <NavLink
          to="/"
          className="font-display whitespace-nowrap text-xl font-extrabold tracking-tight"
        >
          Functie<span className="text-coral"> Elders</span>
        </NavLink>
        <nav aria-label="Hoofdmenu">
          <ul className="flex gap-1 sm:gap-3">
            {nav.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center rounded-full px-3 text-sm sm:text-base ${isActive ? 'text-coral' : 'text-mist hover:text-paper'}`
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/event/:slug" element={<EventPage />} />
        <Route path="/edit/:token" element={<EditPage />} />
        <Route path="/ontdek" element={<Discover />} />
        <Route path="/geschiedenis" element={<History />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/design" element={<DesignSystem />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <footer className="mx-auto mt-24 max-w-6xl border-t border-line px-5 py-8 text-sm text-mist">
        <p>
          Functie Elders · geen cookies, geen tracking · namen en antwoorden zijn nooit publiek.{' '}
          <NavLink to="/design" className="underline underline-offset-4">
            Design
          </NavLink>
          {' · '}
          <NavLink to="/admin" className="underline underline-offset-4">
            Beheer
          </NavLink>
        </p>
      </footer>
    </>
  );
}
