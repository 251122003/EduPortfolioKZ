import { loadJwtSecret } from './session-config.js';

describe('loadJwtSecret', () => {
  it('returns a secret of 32 characters or more', () => {
    const secret = 'a'.repeat(64);
    expect(loadJwtSecret({ JWT_SECRET: secret })).toBe(secret);
  });

  it('refuses to start without JWT_SECRET', () => {
    expect(() => loadJwtSecret({})).toThrow('JWT_SECRET must be set');
    expect(() => loadJwtSecret({ JWT_SECRET: '' })).toThrow('JWT_SECRET must be set');
  });

  it('refuses a short secret', () => {
    expect(() => loadJwtSecret({ JWT_SECRET: 'a'.repeat(31) })).toThrow('at least 32');
  });
});
