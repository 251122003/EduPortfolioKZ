import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/http';
import { routes } from '../../router';
import { useSessionStore } from '../../stores/sessionStore';
import type { MeResponse, SessionResponse } from '../../types/api';

vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  registerStudent: vi.fn(),
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
}));

const student: MeResponse = {
  userId: 'u1',
  role: 'student',
  locale: 'ru',
  studentId: 's1',
  organization: null,
};

function renderLogin(): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter(routes, { initialEntries: ['/login'] });
  render(<RouterProvider router={router} />);
  return router;
}

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const submitButton = (): HTMLElement => screen.getByRole('button', { name: 'Войти' });
const staffTab = (): HTMLElement => screen.getByRole('tab', { name: 'Организация / админ' });

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ user: null, checked: true, loading: false, error: null });
  });

  it('starts on the student tab with phone and password fields', () => {
    renderLogin();

    expect(screen.getByRole('tab', { name: 'Студент' })).toHaveAttribute('aria-selected', 'true');
    expect(staffTab()).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByLabelText('Телефон')).toHaveAttribute('autocomplete', 'tel');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('switches to the staff tab with email', () => {
    renderLogin();
    fireEvent.click(staffTab());

    expect(staffTab()).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.queryByLabelText('Телефон')).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Организация / админ');
  });

  it('moves between tabs with arrow keys', () => {
    renderLogin();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Студент' }), { key: 'ArrowRight' });

    expect(staffTab()).toHaveAttribute('aria-selected', 'true');
    expect(staffTab()).toHaveFocus();
  });

  it('shows field errors and does not call the API for an empty form', () => {
    renderLogin();
    fireEvent.click(submitButton());

    expect(screen.getByLabelText('Телефон')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Пароль')).toHaveAccessibleDescription('Заполните это поле');
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('signs a student in with phone and opens /me', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ userId: 'u1', role: 'student' });
    vi.mocked(authApi.getMe).mockResolvedValue(student);
    const router = renderLogin();
    type('Телефон', '+7 701 234 56 78');
    type('Пароль', 'secret123');
    fireEvent.click(submitButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(authApi.login).toHaveBeenCalledWith({ phone: '+7 701 234 56 78', password: 'secret123' });
  });

  it('signs staff in with email as login', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ userId: 'u2', role: 'organization' });
    vi.mocked(authApi.getMe).mockResolvedValue({ ...student, role: 'organization', studentId: null });
    const router = renderLogin();
    fireEvent.click(staffTab());
    type('Email', ' org@example.kz ');
    type('Пароль', 'secret123');
    fireEvent.click(submitButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(authApi.login).toHaveBeenCalledWith({ login: 'org@example.kz', password: 'secret123' });
  });

  it.each(['student', 'staff'])('shows one general message for 401 (%s tab)', async (tab) => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong login or password'),
    );
    renderLogin();
    if (tab === 'staff') {
      fireEvent.click(staffTab());
      type('Email', 'org@example.kz');
    } else {
      type('Телефон', '87012345678');
    }
    type('Пароль', 'wrong-password');
    fireEvent.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный логин или пароль');
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
    expect(submitButton()).toBeEnabled();
  });

  it('shows 429 from the server', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(429, 'TOO_MANY_REQUESTS', 'Later'));
    renderLogin();
    type('Телефон', '87012345678');
    type('Пароль', 'secret123');
    fireEvent.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Слишком много запросов');
  });

  it('cannot be sent twice while the request runs', async () => {
    let resolve: (value: SessionResponse) => void = () => undefined;
    vi.mocked(authApi.login).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    vi.mocked(authApi.getMe).mockResolvedValue(student);
    const router = renderLogin();
    type('Телефон', '87012345678');
    type('Пароль', 'secret123');
    const form = submitButton().closest('form');
    if (form === null) throw new Error('form not found');

    fireEvent.click(submitButton());
    fireEvent.click(submitButton());
    fireEvent.submit(form);

    expect(submitButton()).toBeDisabled();
    expect(authApi.login).toHaveBeenCalledTimes(1);

    resolve({ userId: 'u1', role: 'student' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
  });
});
