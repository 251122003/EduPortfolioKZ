import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../stores/sessionStore';
import { Header } from '../components/Header';

export function HeaderContainer(): ReactElement {
  const user = useSessionStore((state) => state.user);
  const loading = useSessionStore((state) => state.loading);
  const logout = useSessionStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = (): void => {
    void logout().then(() => navigate('/'));
  };

  return <Header isLoggedIn={user !== null} busy={loading} onLogout={handleLogout} />;
}
