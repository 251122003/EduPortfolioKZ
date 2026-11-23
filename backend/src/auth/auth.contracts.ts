import { z } from 'zod';
import { isValidIin, normalizeIin } from '../common/identity/iin.js';
import { normalizePhone } from '../common/identity/identity-crypto.js';
import type { LoginRequest } from './auth.types.js';

export { userRoles } from './auth.types.js';
export type { ApiErrorBody, LoginRequest, MeResponse, SessionResponse, UserRoleName } from './auth.types.js';

// Request and response shapes for student registration (UC-1).
// One place for both sides: the server validates with these schemas,
// the typed API client will reuse the same types.

const iin = z
  .string()
  .max(32)
  .transform(normalizeIin)
  .refine(isValidIin, { message: 'Invalid IIN' });

const phone = z
  .string()
  .max(32)
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (normalized === null) {
      ctx.addIssue({ code: 'custom', message: 'Invalid phone number' });
      return z.NEVER;
    }
    return normalized;
  });

export const registerStudentSchema = z.object({
  iin,
  fullName: z.string().trim().min(1).max(255),
  phone,
  password: z.string().min(8).max(128),
  locale: z.enum(['kk', 'ru']).default('ru'),
});

export const verifyOtpSchema = z.object({
  otpId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, { message: 'Code must be 6 digits' }),
});

export const resendOtpSchema = z.object({
  otpId: z.uuid(),
});

// FR-25: a student signs in with phone + password, staff (organization, admin) with email + password.
const loginPassword = z.string().min(1).max(128);

export const loginSchema = z.union([
  z.object({ phone, password: loginPassword }),
  z.object({
    login: z.string().trim().toLowerCase().max(255).pipe(z.email()),
    password: loginPassword,
  }),
]);

/** What the client sends to POST /auth/register/student. */
export type RegisterStudentRequest = z.input<typeof registerStudentSchema>;
/** The same body after validation: IIN and phone normalized, locale filled in. */
export type RegisterStudentInput = z.output<typeof registerStudentSchema>;
export type VerifyOtpRequest = z.infer<typeof verifyOtpSchema>;
export type ResendOtpRequest = z.infer<typeof resendOtpSchema>;

/** 202 from register/student and resend-otp. */
export interface OtpSentResponse {
  otpId: string;
}

/** 201 from verify-otp. */
export interface StudentRegisteredResponse {
  studentId: string;
  guardianConsentRequired: boolean;
}

/** The same body after validation: phone normalized, login trimmed and lower-cased. */
export type LoginInput = z.output<typeof loginSchema>;

// The plain LoginRequest in auth.types.ts must accept exactly what the schema accepts.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const loginRequestMatchesSchema: Same<LoginRequest, z.input<typeof loginSchema>> = true;
void loginRequestMatchesSchema;
