import { IdentityCrypto, normalizeName, normalizePhone } from './identity-crypto.js';

const HMAC_KEY = 'a'.repeat(64);
const ENCRYPTION_KEY = 'b'.repeat(64);

describe('IdentityCrypto', () => {
  const crypto = new IdentityCrypto(HMAC_KEY, ENCRYPTION_KEY);

  it('encrypts and decrypts back to the same text', () => {
    const encrypted = crypto.encrypt('080315500123');
    expect(crypto.decrypt(encrypted)).toBe('080315500123');
  });

  it('never stores the plain text and uses a new IV each time', () => {
    const a = crypto.encrypt('080315500123');
    const b = crypto.encrypt('080315500123');
    expect(Buffer.from(a).toString('utf8')).not.toContain('080315500123');
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('detects tampered data', () => {
    const encrypted = crypto.encrypt('080315500123');
    encrypted[encrypted.length - 1] ^= 1;
    expect(() => crypto.decrypt(encrypted)).toThrow();
  });

  it('cannot decrypt with another key', () => {
    const other = new IdentityCrypto(HMAC_KEY, 'c'.repeat(64));
    expect(() => other.decrypt(crypto.encrypt('secret'))).toThrow();
  });

  it('gives a stable 64-character hash that depends on the kind', () => {
    const iinHash = crypto.hash('iin', '7011234567');
    expect(iinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(crypto.hash('iin', '7011234567')).toBe(iinHash);
    expect(crypto.hash('phone', '7011234567')).not.toBe(iinHash);
  });

  it('refuses bad or identical keys', () => {
    expect(() => new IdentityCrypto('short', ENCRYPTION_KEY)).toThrow();
    expect(() => new IdentityCrypto(HMAC_KEY, HMAC_KEY)).toThrow();
    expect(() => IdentityCrypto.fromEnv({})).toThrow();
  });
});

describe('normalizePhone', () => {
  it('brings different spellings to +7XXXXXXXXXX', () => {
    expect(normalizePhone('8 701 123 45 67')).toBe('+77011234567');
    expect(normalizePhone('+7 (701) 123-45-67')).toBe('+77011234567');
    expect(normalizePhone('7011234567')).toBe('+77011234567');
  });

  it('rejects numbers that are not Kazakhstan mobiles', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+7 (495) 123-45-67')).toBeNull();
  });
});

describe('normalizeName', () => {
  it('ignores case, extra spaces and Ё', () => {
    expect(normalizeName('  Сейтқали   Әлия  ')).toBe('СЕЙТҚАЛИ ӘЛИЯ');
    expect(normalizeName('Фёдоров Пётр')).toBe(normalizeName('ФЕДОРОВ ПЕТР'));
  });
});
