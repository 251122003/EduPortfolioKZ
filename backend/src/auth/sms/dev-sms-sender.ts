import { Logger } from '@nestjs/common';
import type { OtpSms, SmsSender } from './sms-sender.js';

// Development only: sends nothing, writes the code to the server console
// so the developer can finish registration. The phone number is never written,
// not even masked; the code is found by otpId, which the API returned to the client.
export class DevSmsSender implements SmsSender {
  private readonly logger = new Logger('DevSmsSender');

  sendOtp(sms: OtpSms): Promise<void> {
    this.logger.log(`Dev SMS (not sent): otpId ${sms.otpId}, code ${sms.code}`);
    return Promise.resolve();
  }
}
