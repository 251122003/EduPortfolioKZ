import type { ApiErrorBody } from '../types/api';

/** Every API path is served by the Vite proxy under this prefix (see vite.config.ts). */
const API_PREFIX = '/api';

/** Error thrown for any non-2xx response, built from `{ error: { code, message } }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Only for OTP_INVALID from verify-otp: how many tries remain. */
  readonly attemptsLeft: number | undefined;

  constructor(status: number, code: string, message: string, attemptsLeft?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.attemptsLeft = attemptsLeft;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error: unknown = value.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

/** The optional attemptsLeft field; ignored when absent or not a number. */
function attemptsLeftOf(body: ApiErrorBody): number | undefined {
  const value: unknown = body.error.attemptsLeft;
  return typeof value === 'number' ? value : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Sends a JSON request to the API. Resolves with the parsed body, or undefined for 204. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_PREFIX + path, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error');
  }

  if (!response.ok) {
    const body = await readJson(response);
    if (isApiErrorBody(body)) {
      throw new ApiError(
        response.status,
        body.error.code,
        body.error.message,
        attemptsLeftOf(body),
      );
    }
    throw new ApiError(response.status, 'UNKNOWN', response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
