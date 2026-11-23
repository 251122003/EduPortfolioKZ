import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '../../router';
import { useSessionStore } from '../../stores/sessionStore';

vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  registerStudent: vi.fn(),
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
}));

function renderAt(path: string): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('RequireAuth', () => {
  it('redirects /me to /login when not signed in', () => {
    useSessionStore.setState({ user: null, checked: true, loading: false, error: null });
    const router = renderAt('/me');

    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('heading', { level: 1, name: 'Вход' })).toBeInTheDocument();
  });

  it('shows loading while the session is not checked yet', () => {
    useSessionStore.setState({ user: null, checked: false, loading: true, error: null });
    const router = renderAt('/me');

    expect(router.state.location.pathname).toBe('/me');
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('opens /me for a signed-in user', () => {
    useSessionStore.setState({
      user: { userId: 'u1', role: 'student', locale: 'ru', studentId: 's1', organization: null },
      checked: true,
      loading: false,
      error: null,
    });
    renderAt('/me');

    expect(screen.getByRole('heading', { level: 1, name: 'Профиль студента' })).toBeInTheDocument();
  });
});
