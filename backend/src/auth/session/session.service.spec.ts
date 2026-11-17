import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'node:crypto';
import { SESSION_TTL_SECONDS } from './session-config.js';
import { SessionService } from './session.service.js';

const SECRET = 'a'.repeat(64);
const service = new SessionService(new JwtService({ secret: SECRET }));

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Builds a token by hand, to try algorithms the service must refuse. */
function handMadeToken(alg: string, payload: object, sign: (data: string) => string): string {
  const data = `${base64url({ alg, typ: 'JWT' })}.${base64url(payload)}`;
  return `${data}.${sign(data)}`;
}

const now = (): number => Math.floor(Date.now() / 1000);

describe('SessionService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('issues a token that verify reads back', async () => {
    const token = await service.issue({ userId: 'user-1', role: 'admin' });
    await expect(service.verify(token)).resolves.toEqual({ userId: 'user-1', role: 'admin' });
  });

  it('puts only sub, role and the 8-hour lifetime into the token', async () => {
    const token = await service.issue({ userId: 'user-1', role: 'student' });
    const header: unknown = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as Record<
      string,
      number
    >;
    expect(header).toMatchObject({ alg: 'HS256' });
    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'role', 'sub']);
    expect(claims.exp - claims.iat).toBe(SESSION_TTL_SECONDS);
  });

  it('rejects a token signed with another secret', async () => {
    const other = new SessionService(new JwtService({ secret: 'b'.repeat(64) }));
    const token = await other.issue({ userId: 'user-1', role: 'admin' });
    await expect(service.verify(token)).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T08:00:00Z'));
    const token = await service.issue({ userId: 'user-1', role: 'admin' });
    vi.setSystemTime(new Date('2026-11-17T16:00:01Z'));
    await expect(service.verify(token)).resolves.toBeNull();
  });

  it('rejects garbage', async () => {
    await expect(service.verify('not-a-token')).resolves.toBeNull();
  });

  it('rejects a token with alg "none"', async () => {
    const token = handMadeToken('none', { sub: 'user-1', role: 'admin', iat: now() }, () => '');
    await expect(service.verify(token)).resolves.toBeNull();
  });

  it('rejects HS512 even when signed with the right secret', async () => {
    const payload = { sub: 'user-1', role: 'admin', iat: now(), exp: now() + 60 };
    const token = handMadeToken('HS512', payload, (data) =>
      createHmac('sha512', SECRET).update(data).digest('base64url'),
    );
    await expect(service.verify(token)).resolves.toBeNull();
  });

  it('accepts a hand-made HS256 token (so the two tests above fail only on the algorithm)', async () => {
    const payload = { sub: 'user-1', role: 'admin', iat: now(), exp: now() + 60 };
    const token = handMadeToken('HS256', payload, (data) =>
      createHmac('sha256', SECRET).update(data).digest('base64url'),
    );
    await expect(service.verify(token)).resolves.toEqual({ userId: 'user-1', role: 'admin' });
  });

  it('rejects a correctly signed token with an unknown role', async () => {
    const jwt = new JwtService({ secret: SECRET });
    const token = await jwt.signAsync({ sub: 'user-1', role: 'superuser' });
    await expect(service.verify(token)).resolves.toBeNull();
  });
});
