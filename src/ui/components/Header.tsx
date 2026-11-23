import type { ReactElement } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { t } from '../../i18n';

interface HeaderProps {
  isLoggedIn: boolean;
  busy: boolean;
  onLogout: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `text-sm font-medium hover:text-primary ${isActive ? 'text-primary' : 'text-ink/80'}`;

export function Header({ isLoggedIn, busy, onLogout }: HeaderProps): ReactElement {
  return (
    <header className="border-b border-ink/10 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="text-lg font-bold text-primary">
          {t.appName}
        </Link>
        <nav aria-label={t.nav.mainLabel} className="flex items-center gap-6">
          <NavLink to="/" end className={navLinkClass}>
            {t.nav.home}
          </NavLink>
          {isLoggedIn && (
            <NavLink to="/me" className={navLinkClass}>
              {t.nav.profile}
            </NavLink>
          )}
          {isLoggedIn ? (
            <button
              type="button"
              onClick={onLogout}
              disabled={busy}
              className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
            >
              {t.nav.logout}
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              {t.nav.login}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
