import { create } from 'zustand';
import * as authApi from '../api/auth';
import { ApiError } from '../api/http';
import type { LoginRequest, MeResponse } from '../types/api';

interface SessionState {
  user: MeResponse | null;
  loading: boolean;
  /** Error code from the last failed action, e.g. INVALID_CREDENTIALS. */
  error: string | null;
  /** True after the first loadMe finished, so guards know whether the session is known. */
  checked: boolean;
  loadMe: () => Promise<void>;
  login: (body: LoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
}

function errorCode(error: unknown): string {
  return error instanceof ApiError ? error.code : 'UNKNOWN';
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  loading: false,
  error: null,
  checked: false,

  loadMe: async () => {
    set({ loading: true, error: null });
    try {
      const user = await authApi.getMe();
      set({ user, loading: false, checked: true });
    } catch (error) {
      // 401 just means "not signed in"; it is not an error to show.
      const unauthorized = error instanceof ApiError && error.status === 401;
      set({ user: null, loading: false, checked: true, error: unauthorized ? null : errorCode(error) });
    }
  },

  login: async (body) => {
    set({ loading: true, error: null });
    try {
      await authApi.login(body);
      const user = await authApi.getMe();
      set({ user, loading: false, checked: true });
      return true;
    } catch (error) {
      set({ user: null, loading: false, error: errorCode(error) });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      await authApi.logout();
      set({ user: null, loading: false });
    } catch (error) {
      set({ loading: false, error: errorCode(error) });
    }
  },
}));
