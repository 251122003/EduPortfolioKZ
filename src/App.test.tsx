import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as authApi from './api/auth';
import { ApiError } from './api/http';
import { App } from './App';
import { useSessionStore } from './stores/sessionStore';

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  registerStudent: vi.fn(),
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
}));

describe('App', () => {
  it('checks the session on start and renders the home page', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Sign in required'));
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(useSessionStore.getState().checked).toBe(true));
    expect(authApi.getMe).toHaveBeenCalledOnce();
  });
});
