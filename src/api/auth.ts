import type {
  LoginRequest,
  MeResponse,
  OtpSentResponse,
  RegisterStudentRequest,
  ResendOtpRequest,
  SessionResponse,
  StudentRegisteredResponse,
  VerifyOtpRequest,
} from '../types/api';
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

/** Starts registration (UC-1): the server sends an SMS code and returns its otpId. */
export function registerStudent(body: RegisterStudentRequest): Promise<OtpSentResponse> {
  return request<OtpSentResponse>('/auth/register/student', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Confirms the SMS code; on success the server also sets the session cookie. */
export function verifyOtp(body: VerifyOtpRequest): Promise<StudentRegisteredResponse> {
  return request<StudentRegisteredResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Sends a new code; the returned otpId replaces the old one. */
export function resendOtp(body: ResendOtpRequest): Promise<OtpSentResponse> {
  return request<OtpSentResponse>('/auth/resend-otp', { method: 'POST', body: JSON.stringify(body) });
}
