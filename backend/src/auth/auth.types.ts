// Plain API types for the auth endpoints, shared by the server and the web client.
// No imports on purpose: the browser code imports this file with `import type`,
// so it must not pull in zod or node-only modules.

export const userRoles = ['student', 'organization', 'admin'] as const;
export type UserRoleName = (typeof userRoles)[number];

/** What the client sends to POST /auth/login: a student uses phone, staff use email as login. */
export type LoginRequest = { phone: string; password: string } | { login: string; password: string };

/** What the client sends to POST /auth/register/student. */
export interface RegisterStudentRequest {
  iin: string;
  fullName: string;
  phone: string;
  password: string;
  locale?: 'kk' | 'ru' | undefined;
}

/** What the client sends to POST /auth/verify-otp. */
export interface VerifyOtpRequest {
  otpId: string;
  code: string;
}

/** What the client sends to POST /auth/resend-otp. */
export interface ResendOtpRequest {
  otpId: string;
}

/** 202 from register/student and resend-otp. */
export interface OtpSentResponse {
  otpId: string;
}

/** 201 from verify-otp. The session itself travels in the httpOnly cookie. */
export interface StudentRegisteredResponse {
  studentId: string;
  guardianConsentRequired: boolean;
}

/** 200 from POST /auth/login. The session itself travels in the httpOnly cookie. */
export interface SessionResponse {
  userId: string;
  role: UserRoleName;
}

/** 200 from GET /auth/me. Never contains IIN or phone. */
export interface MeResponse {
  userId: string;
  role: UserRoleName;
  locale: 'kk' | 'ru';
  /** Set for students only. */
  studentId: string | null;
  /** Set for organization staff only. */
  organization: {
    id: string;
    name: string;
    status: 'pending' | 'verified' | 'rejected' | 'suspended';
  } | null;
}

/** Body of every error response. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Sent only by POST /auth/verify-otp on a wrong code (OTP_INVALID). */
    attemptsLeft?: number;
  };
}
