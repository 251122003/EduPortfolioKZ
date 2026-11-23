import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/http';
import { routes } from '../../router';
import { useSessionStore } from '../../stores/sessionStore';
import type { OtpSentResponse } from '../../types/api';

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

function type(label: string | RegExp, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValidForm(): void {
  type('ИИН', '080101500123');
  type('Фамилия', ' Иванов ');
  type('Имя', 'Иван');
  type('Отчество', 'Иванович');
  type('Телефон', '+7 701 234 56 78');
  type('Пароль', 'secret123');
  fireEvent.click(screen.getByLabelText(/согласен/));
}

const submitButton = (): HTMLElement => screen.getByRole('button', { name: 'Получить SMS-код' });

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ user: null, checked: true, loading: false, error: null });
  });

  it('finds every field by its label, with hints and autocomplete', () => {
    renderAt('/register');

    expect(screen.getByLabelText('ИИН')).toHaveAccessibleDescription(/12 цифр/);
    expect(screen.getByLabelText('Фамилия')).toHaveAttribute('autocomplete', 'family-name');
    expect(screen.getByLabelText('Имя')).toBeInTheDocument();
    expect(screen.getByLabelText('Отчество')).toBeInTheDocument();
    expect(screen.getByLabelText('Телефон')).toHaveAttribute('autocomplete', 'tel');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText(/согласен/)).not.toBeChecked();
  });

  it('shows field errors linked to the fields and does not call the API', () => {
    renderAt('/register');
    type('ИИН', '12345678901');
    fireEvent.click(submitButton());

    const iin = screen.getByLabelText('ИИН');
    expect(iin).toHaveAttribute('aria-invalid', 'true');
    expect(iin).toHaveAccessibleDescription(/ИИН должен состоять из 12 цифр/);
    expect(iin).toHaveFocus();
    expect(screen.getByLabelText('Фамилия')).toHaveAccessibleDescription(/Заполните это поле/);
    expect(screen.getByLabelText(/согласен/)).toHaveAccessibleDescription(/Без согласия/);
    expect(authApi.registerStudent).not.toHaveBeenCalled();
  });

  it('does not send the form without consent', () => {
    renderAt('/register');
    fillValidForm();
    fireEvent.click(screen.getByLabelText(/согласен/));
    fireEvent.click(submitButton());

    expect(screen.getByLabelText(/согласен/)).toHaveAttribute('aria-invalid', 'true');
    expect(authApi.registerStudent).not.toHaveBeenCalled();
  });

  it('sends fullName from three parts and opens /register/otp with the otpId only', async () => {
    vi.mocked(authApi.registerStudent).mockResolvedValue({ otpId: 'otp-1' });
    const router = renderAt('/register');
    fillValidForm();
    fireEvent.click(submitButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/register/otp'));
    expect(authApi.registerStudent).toHaveBeenCalledWith({
      iin: '080101500123',
      fullName: 'Иванов Иван Иванович',
      phone: '+7 701 234 56 78',
      password: 'secret123',
      locale: 'ru',
    });
    expect(router.state.location.state).toEqual({ otpId: 'otp-1' });
  });

  it('leaves out an empty middle name', async () => {
    vi.mocked(authApi.registerStudent).mockResolvedValue({ otpId: 'otp-1' });
    renderAt('/register');
    fillValidForm();
    type('Отчество', '  ');
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(authApi.registerStudent).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: 'Иванов Иван' }),
      ),
    );
  });

  it.each([
    ['VALIDATION_ERROR', 422, 'Проверьте правильность заполнения полей'],
    ['TOO_MANY_REQUESTS', 429, 'Слишком много запросов. Подождите немного и попробуйте снова'],
  ])('shows the server error %s', async (code, status, text) => {
    vi.mocked(authApi.registerStudent).mockRejectedValue(new ApiError(status, code, 'server text'));
    renderAt('/register');
    fillValidForm();
    fireEvent.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.queryByText('server text')).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it('cannot be sent twice while the request runs', async () => {
    let resolve: (value: OtpSentResponse) => void = () => undefined;
    vi.mocked(authApi.registerStudent).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const router = renderAt('/register');
    fillValidForm();
    const form = submitButton().closest('form');
    if (form === null) throw new Error('form not found');

    fireEvent.click(submitButton());
    fireEvent.click(submitButton());
    fireEvent.submit(form);

    expect(submitButton()).toBeDisabled();
    expect(authApi.registerStudent).toHaveBeenCalledTimes(1);

    resolve({ otpId: 'otp-1' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/register/otp'));
  });
});
