import { UnprocessableEntityException } from '@nestjs/common';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import {
  loginSchema,
  registerStudentSchema,
  resendOtpSchema,
  verifyOtpSchema,
} from './auth.contracts.js';

// Synthetic IIN with a valid check digit: born 2008-03-15.
const valid = {
  iin: '080315 600016',
  fullName: '  Сейтқали Аружан ',
  phone: '8 (701) 000-00-01',
  password: 'Correct-Horse-1',
};

describe('registerStudentSchema', () => {
  const pipe = new ZodValidationPipe(registerStudentSchema);

  it('normalizes IIN, phone and name and fills the default locale', () => {
    expect(pipe.transform(valid)).toEqual({
      iin: '080315600016',
      fullName: 'Сейтқали Аружан',
      phone: '+77010000001',
      password: 'Correct-Horse-1',
      locale: 'ru',
    });
  });

  it.each([
    ['wrong check digit', { iin: '080315600017' }],
    ['impossible birth date', { iin: '081315600016' }],
    ['not 12 digits', { iin: '12345' }],
    ['not a Kazakhstan mobile', { phone: '+1 202 555 0100' }],
    ['short password', { password: 'short' }],
    ['long password', { password: 'x'.repeat(129) }],
    ['empty name', { fullName: '   ' }],
    ['unknown locale', { locale: 'en' }],
  ])('answers 422 for %s', (_reason, change) => {
    expect(() => pipe.transform({ ...valid, ...change })).toThrow(UnprocessableEntityException);
  });

  it('never echoes the IIN in the error message', () => {
    try {
      pipe.transform({ ...valid, iin: '080315600017' });
      expect.unreachable();
    } catch (error: unknown) {
      const body = (error as UnprocessableEntityException).getResponse();
      expect(JSON.stringify(body)).not.toContain('080315600017');
      expect(body).toMatchObject({ code: 'VALIDATION_ERROR', message: 'iin: Invalid IIN' });
    }
  });

  it('accepts 8 and 128 character passwords', () => {
    expect(() => pipe.transform({ ...valid, password: 'x'.repeat(8) })).not.toThrow();
    expect(() => pipe.transform({ ...valid, password: 'x'.repeat(128) })).not.toThrow();
  });
});

describe('verifyOtpSchema and resendOtpSchema', () => {
  const otpId = '0190a000-0000-7000-8000-000000000001';

  it('accepts a uuid and 6 digits', () => {
    expect(verifyOtpSchema.parse({ otpId, code: '012345' })).toEqual({ otpId, code: '012345' });
    expect(resendOtpSchema.parse({ otpId })).toEqual({ otpId });
  });

  it.each(['12345', '1234567', 'abcdef'])('rejects code %s', (code) => {
    expect(verifyOtpSchema.safeParse({ otpId, code }).success).toBe(false);
  });

  it('rejects an otpId that is not a uuid', () => {
    expect(verifyOtpSchema.safeParse({ otpId: '1', code: '123456' }).success).toBe(false);
    expect(resendOtpSchema.safeParse({ otpId: '1' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  const pipe = new ZodValidationPipe(loginSchema);

  it('normalizes a student phone', () => {
    expect(pipe.transform({ phone: '8 (701) 000-00-01', password: 'x' })).toEqual({
      phone: '+77010000001',
      password: 'x',
    });
  });

  it('trims and lower-cases a staff email', () => {
    expect(pipe.transform({ login: '  Org@EduPortfolio.TEST ', password: 'x' })).toEqual({
      login: 'org@eduportfolio.test',
      password: 'x',
    });
  });

  it.each([
    ['no phone and no login', { password: 'x' }],
    ['not a Kazakhstan mobile', { phone: '+1 202 555 0100', password: 'x' }],
    ['not an email', { login: 'org', password: 'x' }],
    ['empty password', { login: 'org@eduportfolio.test', password: '' }],
    ['long password', { login: 'org@eduportfolio.test', password: 'x'.repeat(129) }],
  ])('answers 422 for %s', (_reason, body) => {
    expect(() => pipe.transform(body)).toThrow(UnprocessableEntityException);
  });

  it('never echoes the phone or the password in the error message', () => {
    try {
      pipe.transform({ phone: '+1 202 555 0100', password: 'Secret-Password' });
      expect.unreachable();
    } catch (error: unknown) {
      const body = JSON.stringify((error as UnprocessableEntityException).getResponse());
      expect(body).not.toContain('202 555');
      expect(body).not.toContain('Secret-Password');
    }
  });
});
