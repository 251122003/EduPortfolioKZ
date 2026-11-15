// The one body format for every API error: { "error": { "code": "...", "message": "..." } }.
// Shared by the server (exception filter) and, later, the typed API client.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export function apiError(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}
