import { DevSmsSender } from './dev-sms-sender.js';

export interface OtpSms {
  /** Normalized phone, +7XXXXXXXXXX. Only a real provider may use it; it is never logged. */
  phone: string;
  otpId: string;
  code: string;
  locale: 'kk' | 'ru';
}

// The SMS gateway is outside the system. Real providers implement this interface later.
export interface SmsSender {
  sendOtp(sms: OtpSms): Promise<void>;
}

export const SMS_SENDER = Symbol('SMS_SENDER');

/**
 * Picks the sender from SMS_PROVIDER. Only "mock" exists for now.
 * The mock never runs in production: the app refuses to start instead.
 */
export function createSmsSender(env: NodeJS.ProcessEnv = process.env): SmsSender {
  const provider = env.SMS_PROVIDER ?? 'mock';
  if (provider !== 'mock') {
    throw new Error(`SMS_PROVIDER "${provider}" is not supported yet`);
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('SMS_PROVIDER=mock must not be used in production');
  }
  return new DevSmsSender();
}
