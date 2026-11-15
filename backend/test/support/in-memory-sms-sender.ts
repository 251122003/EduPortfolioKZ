import type { OtpSms, SmsSender } from '../../src/auth/sms/sms-sender.js';

// For e2e tests: keeps the codes in memory so a test can read the code it would get by SMS.
export class InMemorySmsSender implements SmsSender {
  private readonly codes = new Map<string, string>();

  sendOtp(sms: OtpSms): Promise<void> {
    this.codes.set(sms.otpId, sms.code);
    return Promise.resolve();
  }

  codeFor(otpId: string): string {
    const code = this.codes.get(otpId);
    if (code === undefined) {
      throw new Error(`No SMS was sent for otpId ${otpId}`);
    }
    return code;
  }
}
