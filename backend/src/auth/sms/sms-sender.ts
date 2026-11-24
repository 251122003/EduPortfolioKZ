import { Logger } from '@nestjs/common';
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
 * In production the mock is refused (the app does not start), unless
 * SMS_MOCK_ALLOWED_IN_PRODUCTION=true is set for the course demo; then a warning is logged.
 */
export function createSmsSender(env: NodeJS.ProcessEnv = process.env): SmsSender {
  const provider = env.SMS_PROVIDER ?? 'mock';
  if (provider !== 'mock') {
    throw new Error(`SMS_PROVIDER "${provider}" is not supported yet`);
  }
  if (env.NODE_ENV === 'production') {
    if (env.SMS_MOCK_ALLOWED_IN_PRODUCTION !== 'true') {
      throw new Error(
        'SMS_PROVIDER=mock must not be used in production (set SMS_MOCK_ALLOWED_IN_PRODUCTION=true only for a demo)',
      );
    }
    new Logger('SmsSender').warn(
      'SMS mock is enabled in production: demo only, no SMS is sent and codes go to the server log',
    );
  }
  return new DevSmsSender();
}
