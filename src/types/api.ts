// API payload types come from one place shared with the server.
// `export type` keeps server code out of the browser bundle.
export type {
  ApiErrorBody,
  LoginRequest,
  MeResponse,
  SessionResponse,
  UserRoleName,
} from '../../backend/src/auth/auth.types';
