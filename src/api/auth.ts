import type { LoginRequest, MeResponse, SessionResponse } from '../types/api';
import { request } from './http';

export function login(body: LoginRequest): Promise<SessionResponse> {
  return request<SessionResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) });
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function getMe(): Promise<MeResponse> {
  return request<MeResponse>('/auth/me');
}
