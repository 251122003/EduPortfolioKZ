import { Logger } from '@nestjs/common';
import { DevSmsSender } from './dev-sms-sender.js';
import { createSmsSender } from './sms-sender.js';

describe('createSmsSender', () => {
  it('uses the dev sender when SMS_PROVIDER is mock or empty', () => {
    expect(createSmsSender({ SMS_PROVIDER: 'mock' })).toBeInstanceOf(DevSmsSender);
    expect(createSmsSender({})).toBeInstanceOf(DevSmsSender);
  });

  it('refuses the mock in production', () => {
    expect(() => createSmsSender({ SMS_PROVIDER: 'mock', NODE_ENV: 'production' })).toThrow(
      /production/,
    );
  });

  it('refuses a provider that does not exist yet', () => {
    expect(() => createSmsSender({ SMS_PROVIDER: 'twilio' })).toThrow(/not supported/);
  });
});

describe('DevSmsSender', () => {
  it('logs the otpId and code but never the phone', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await new DevSmsSender().sendOtp({
      phone: '+77010000001',
      otpId: 'otp-1',
      code: '123456',
      locale: 'ru',
    });
    const written = JSON.stringify(log.mock.calls);
    expect(written).toContain('otp-1');
    expect(written).toContain('123456');
    expect(written).not.toContain('7010000001');
    log.mockRestore();
  });
});
