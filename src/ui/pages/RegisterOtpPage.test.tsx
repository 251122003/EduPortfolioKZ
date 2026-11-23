import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/http';
import { routes } from '../../router';
import { useSessionStore } from '../../stores/sessionStore';
import type { StudentRegisteredResponse } from '../../types/api';
import { RESEND_DELAY_SECONDS } from './RegisterOtpPage';

vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  registerStudent: vi.fn(),
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
}));

function renderOtp(state: unknown = { otpId: 'otp-1' }): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter(routes, {
    initialEntries: [{ pathname: '/register/otp', state }],
  });
  render(<RouterProvider router={router} />);
  return router;
}

function enterCode(code: string): void {
  fireEvent.change(screen.getByLabelText('Код из SMS'), { target: { value: code } });
}

const confirmButton = (): HTMLElement => screen.getByRole('button', { name: 'Подтвердить' });
const resendButton = (): HTMLElement => screen.getByRole('button', { name: 'Отправить снова' });

function passResendDelay(): void {
  for (let i = 0; i < RESEND_DELAY_SECONDS; i += 1) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
}

describe('RegisterOtpPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ user: null, checked: true, loading: false, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks to start again when there is no otpId (page reloaded)', () => {
    renderOtp(null);

    expect(screen.getByRole('link', { name: 'Начать регистрацию заново' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.queryByLabelText('Код из SMS')).not.toBeInTheDocument();
  });

  it('finds the code field by its label with one-time-code autocomplete', () => {
    renderOtp();

    const input = screen.getByLabelText('Код из SMS');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAccessibleDescription('6 цифр');
  });

  it('checks the code format before calling the API', () => {
    renderOtp();
    enterCode('12a3');
    fireEvent.click(confirmButton());

    expect(screen.getByLabelText('Код из SMS')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Код из SMS')).toHaveAccessibleDescription(/Введите 6 цифр/);
    expect(authApi.verifyOtp).not.toHaveBeenCalled();
  });

  it('shows attemptsLeft for a wrong code (400)', async () => {
    vi.mocked(authApi.verifyOtp).mockRejectedValue(new ApiError(400, 'OTP_INVALID', 'Wrong code', 3));
    renderOtp();
    enterCode('123456');
    fireEvent.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный код. Осталось попыток: 3');
    expect(authApi.verifyOtp).toHaveBeenCalledWith({ otpId: 'otp-1', code: '123456' });
  });

  it.each([
    [410, 'OTP_EXPIRED', 'Код истёк или больше не действует. Запросите новый код'],
    [429, 'TOO_MANY_REQUESTS', 'Слишком много запросов. Подождите немного и попробуйте снова'],
    [409, 'STUDENT_DATA_MISMATCH', 'Данные не совпадают с записью организатора. Обратитесь к организатору'],
  ])('shows a clear message for %i %s', async (status, code, text) => {
    vi.mocked(authApi.verifyOtp).mockRejectedValue(new ApiError(status, code, 'server text'));
    renderOtp();
    enterCode('123456');
    fireEvent.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(confirmButton()).toBeEnabled();
  });

  it('locks the form after 423', async () => {
    vi.mocked(authApi.verifyOtp).mockRejectedValue(new ApiError(423, 'OTP_LOCKED', 'Locked'));
    renderOtp();
    enterCode('123456');
    fireEvent.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Слишком много неверных попыток. Попробуйте через 15 минут',
    );
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByLabelText('Код из SMS')).toBeDisabled();
  });

  it('enables "Отправить снова" only after 60 seconds and uses the new otpId', async () => {
    vi.useFakeTimers();
    vi.mocked(authApi.resendOtp).mockResolvedValue({ otpId: 'otp-2' });
    vi.mocked(authApi.verifyOtp).mockRejectedValue(new ApiError(410, 'OTP_EXPIRED', 'Expired'));
    renderOtp();

    expect(resendButton()).toBeDisabled();
    expect(screen.getByText('Отправить снова можно через 60 с')).toBeInTheDocument();
    passResendDelay();
    expect(resendButton()).toBeEnabled();

    await act(async () => {
      fireEvent.click(resendButton());
    });
    expect(authApi.resendOtp).toHaveBeenCalledWith({ otpId: 'otp-1' });
    expect(screen.getByRole('status')).toHaveTextContent('Новый код отправлен');
    expect(resendButton()).toBeDisabled();

    enterCode('654321');
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(authApi.verifyOtp).toHaveBeenCalledWith({ otpId: 'otp-2', code: '654321' });
  });

  it('shows 429 from resend', async () => {
    vi.useFakeTimers();
    vi.mocked(authApi.resendOtp).mockRejectedValue(new ApiError(429, 'TOO_MANY_REQUESTS', 'Later'));
    renderOtp();
    passResendDelay();

    await act(async () => {
      fireEvent.click(resendButton());
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Слишком много запросов');
  });

  it('opens /me with the guardian consent notice after a correct code', async () => {
    vi.mocked(authApi.verifyOtp).mockResolvedValue({ studentId: 's1', guardianConsentRequired: true });
    vi.mocked(authApi.getMe).mockResolvedValue({
      userId: 'u1',
      role: 'student',
      locale: 'ru',
      studentId: 's1',
      organization: null,
    });
    const router = renderOtp();
    enterCode('123456');
    fireEvent.click(confirmButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(await screen.findByRole('status')).toHaveTextContent(/нет 18 лет/);
  });

  it('cannot be sent twice while the request runs', async () => {
    let resolve: (value: StudentRegisteredResponse) => void = () => undefined;
    vi.mocked(authApi.verifyOtp).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    vi.mocked(authApi.getMe).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'No'));
    renderOtp();
    enterCode('123456');
    const form = confirmButton().closest('form');
    if (form === null) throw new Error('form not found');

    fireEvent.click(confirmButton());
    fireEvent.click(confirmButton());
    fireEvent.submit(form);

    expect(confirmButton()).toBeDisabled();
    expect(authApi.verifyOtp).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ studentId: 's1', guardianConsentRequired: false });
    });
  });
});
