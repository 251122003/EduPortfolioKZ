import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { t } from '../../i18n';
import { useSessionStore } from '../../stores/sessionStore';

/** Lets signed-in users through; everyone else is sent to /login. */
export function RequireAuth(): ReactElement {
  const user = useSessionStore((state) => state.user);
  const checked = useSessionStore((state) => state.checked);
  const location = useLocation();

  if (!checked) return <p className="text-ink/70">{t.common.loading}</p>;
  if (user === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
