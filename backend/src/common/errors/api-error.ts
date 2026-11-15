// The one body format for every API error: { "error": { "code": "...", "message": "..." } }.
// Shared by the server (exception filter) and, later, the typed API client.
// attemptsLeft is optional and sent only by POST /auth/verify-otp on a wrong code.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    attemptsLeft?: number;
  };
}

export function apiError(code: string, message: string, attemptsLeft?: number): ApiErrorBody {
  return attemptsLeft === undefined
    ? { error: { code, message } }
    : { error: { code, message, attemptsLeft } };
}
