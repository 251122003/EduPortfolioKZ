import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// End-to-end test of sign-in (FR-25) against the real local database from backend/.env.
// Needs the demo data: run `npx prisma db seed` once before this test.
const ORG_LOGIN = 'org@eduportfolio.test';
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Demo-Password-2026';

function sessionCookie(response: request.Response): string {
  const header: unknown = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header.filter((c): c is string => typeof c === 'string') : [];
  const session = cookies.find((cookie) => cookie.startsWith('session='));
  if (session === undefined) {
    throw new Error('No session cookie in the response');
  }
  return session;
}

describe('Sign-in and session (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs the seed organization in, shows /api/auth/me and signs out', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: ORG_LOGIN, password: SEED_PASSWORD })
      .expect(200);
    expect(login.body).toEqual({ userId: expect.any(String), role: 'organization' });

    const cookie = sessionCookie(login);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Secure/i); // only in production

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie.split(';')[0])
      .expect(200);
    expect(me.body).toEqual({
      userId: (login.body as { userId: string }).userId,
      role: 'organization',
      locale: 'ru',
      studentId: null,
      organization: { id: expect.any(String), name: 'Demo Olympiad Center', status: 'verified' },
    });

    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookie.split(';')[0])
      .expect(204);
    const cleared = sessionCookie(logout);
    expect(cleared).toMatch(/^session=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);

    // After logout the browser has no cookie any more.
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('answers 401 UNAUTHORIZED on /api/auth/me without a cookie or with a forged one', async () => {
    const missing = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(missing.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4Iiwicm9sZSI6ImFkbWluIn0.')
      .expect(401);
  });

  it('gives a wrong password and an unknown email the same 401 and no cookie', async () => {
    const expected = {
      error: { code: 'INVALID_CREDENTIALS', message: 'Wrong login or password' },
    };

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: ORG_LOGIN, password: 'Wrong-Password-1' })
      .expect(401);
    expect(wrongPassword.body).toEqual(expected);
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();

    const unknown = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'nobody@eduportfolio.test', password: SEED_PASSWORD })
      .expect(401);
    expect(unknown.body).toEqual(expected);

    const unknownPhone = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: '+7 709 999 99 99', password: SEED_PASSWORD })
      .expect(401);
    expect(unknownPhone.body).toEqual(expected);
  });

  it('answers 422 for a body that is neither phone nor email', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ password: 'x' })
      .expect(422);
    expect((response.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });
});
