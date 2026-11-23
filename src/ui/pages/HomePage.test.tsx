import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../router';
import { useSessionStore } from '../../stores/sessionStore';

// No network in tests: the API client is replaced with stubs.
vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  registerStudent: vi.fn(),
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
}));

function renderAt(path: string): void {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe('HomePage', () => {
  beforeEach(() => {
    useSessionStore.setState({ user: null, checked: true, loading: false, error: null });
  });

  it('renders the main heading and both sections', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Все дипломы и сертификаты студента в одном месте',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Для кого' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Как это работает' })).toBeInTheDocument();
  });

  it('has links to register, verify and login', () => {
    renderAt('/');

    expect(screen.getByRole('link', { name: 'Зарегистрироваться' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Проверить диплом' })).toHaveAttribute('href', '#how-it-works');
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'EduPortfolio KZ' })).toHaveAttribute('href', '/');
  });

  it('shows Logout instead of Login when signed in', () => {
    useSessionStore.setState({
      user: { userId: 'u1', role: 'student', locale: 'ru', studentId: 's1', organization: null },
    });
    renderAt('/');

    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Войти' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Мой профиль' })).toHaveAttribute('href', '/me');
  });

  it('shows the 404 page for an unknown path', () => {
    renderAt('/no-such-page');

    expect(screen.getByRole('heading', { level: 1, name: 'Страница не найдена' })).toBeInTheDocument();
  });
});
