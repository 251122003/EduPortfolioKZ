import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from './api/auth';
import { routes } from './router';
import { useSessionStore } from './stores/sessionStore';

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}));

function renderAt(path: string): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ user: null, checked: true, loading: false, error: null });
  });

  it.each([
    ['/register', 'Регистрация'],
    ['/register/otp', 'Подтверждение по SMS'],
    ['/login', 'Вход'],
    ['/v/some-token', 'Проверка диплома'],
  ])('%s shows the page title', (path, title) => {
    renderAt(path);

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('Logout clears the session and goes home', async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    useSessionStore.setState({
      user: { userId: 'u1', role: 'student', locale: 'ru', studentId: 's1', organization: null },
    });
    const router = renderAt('/me');

    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(authApi.logout).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Войти' })).toBeInTheDocument();
  });
});
