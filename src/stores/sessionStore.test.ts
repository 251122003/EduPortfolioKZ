import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../api/auth';
import { ApiError } from '../api/http';
import type { MeResponse } from '../types/api';
import { useSessionStore } from './sessionStore';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}));

const me: MeResponse = {
  userId: 'u1',
  role: 'student',
  locale: 'ru',
  studentId: 's1',
  organization: null,
};

describe('sessionStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ user: null, checked: false, loading: false, error: null });
  });

  it('loadMe stores the user', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(me);
    await useSessionStore.getState().loadMe();

    expect(useSessionStore.getState()).toMatchObject({ user: me, checked: true, loading: false });
  });

  it('loadMe treats 401 as signed out without an error', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Sign in required'));
    await useSessionStore.getState().loadMe();

    expect(useSessionStore.getState()).toMatchObject({ user: null, checked: true, error: null });
  });

  it('login loads the user on success', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ userId: 'u1', role: 'student' });
    vi.mocked(authApi.getMe).mockResolvedValue(me);
    const ok = await useSessionStore.getState().login({ phone: '+77001234567', password: 'secret123' });

    expect(ok).toBe(true);
    expect(useSessionStore.getState().user).toEqual(me);
  });

  it('login keeps the error code on failure', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong login or password'),
    );
    const ok = await useSessionStore.getState().login({ login: 'a@b.kz', password: 'x' });

    expect(ok).toBe(false);
    expect(useSessionStore.getState()).toMatchObject({ user: null, error: 'INVALID_CREDENTIALS' });
  });

  it('logout clears the user', async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    useSessionStore.setState({ user: me, checked: true });
    await useSessionStore.getState().logout();

    expect(useSessionStore.getState().user).toBeNull();
  });

  it('logout keeps the user and the error code when the request fails', async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Network error'));
    useSessionStore.setState({ user: me, checked: true });
    await useSessionStore.getState().logout();

    expect(useSessionStore.getState()).toMatchObject({ user: me, error: 'NETWORK_ERROR' });
  });

  it('loadMe keeps a non-401 error code', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('boom'));
    await useSessionStore.getState().loadMe();

    expect(useSessionStore.getState()).toMatchObject({ user: null, checked: true, error: 'UNKNOWN' });
  });
});
