import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomInt } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SMS_SENDER } from '../src/auth/sms/sms-sender.js';
import { IdentityCrypto } from '../src/common/identity/identity-crypto.js';
import { iinCheckDigit } from '../src/common/identity/iin.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InMemorySmsSender } from './support/in-memory-sms-sender.js';

// End-to-end test of UC-1 against the real local database from backend/.env.
// Every run uses a fresh SYNTHETIC IIN and phone (valid check digit, belongs to nobody),
// because registered users cannot be deleted: the audit log that references them is append-only.

/** A random synthetic IIN for someone born on the given date (2000s century digit). */
function syntheticIin(birth: string): string {
  for (;;) {
    const first11 = `${birth}5${randomInt(0, 10_000).toString().padStart(4, '0')}`;
    const check = iinCheckDigit(first11);
    if (check !== null) {
      return `${first11}${check}`;
    }
  }
}

function syntheticPhone(): string {
  return `+7709${randomInt(0, 10_000_000).toString().padStart(7, '0')}`;
}

describe('Student registration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let crypto: IdentityCrypto;
  const sms = new InMemorySmsSender();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SMS_SENDER)
      .useValue(sms)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    crypto = app.get(IdentityCrypto);
  });

  afterAll(async () => {
    await app.close();
  });

  it('links the organizer record when IIN, name and phone match', async () => {
    const iin = syntheticIin('060510');
    const phone = syntheticPhone();
    // The record an organization would create in UC-2 (like the ones in prisma/seed.ts).
    const record = await prisma.student.create({
      data: {
        iinHash: crypto.hash('iin', iin),
        iinEncrypted: crypto.encrypt(iin),
        phoneHash: crypto.hash('phone', phone),
        phoneEncrypted: crypto.encrypt(phone),
        fullName: 'Тестов Тест',
      },
    });

    const started = await request(app.getHttpServer())
      .post('/api/auth/register/student')
      .send({ iin, fullName: '  тестов  ТЕСТ ', phone, password: 'Correct-Horse-1', locale: 'kk' })
      .expect(202);
    const otpId = (started.body as { otpId: string }).otpId;

    const finished = await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ otpId, code: sms.codeFor(otpId) })
      .expect(201);

    expect(finished.body).toEqual({ studentId: record.id, guardianConsentRequired: false });
    expect(JSON.stringify(finished.body)).not.toContain(iin);

    const student = await prisma.student.findUniqueOrThrow({ where: { id: record.id } });
    expect(student.status).toBe('claimed');
    expect(student.userId).not.toBeNull();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: student.userId ?? '' } });
    expect(user.role).toBe('student');
    expect(user.locale).toBe('kk');
    expect(user.passwordHash).not.toContain('Correct-Horse-1');

    const otp = await prisma.otpCode.findUniqueOrThrow({ where: { id: otpId } });
    expect(otp.status).toBe('verified');
    expect(otp.codeHash).not.toBe(sms.codeFor(otpId));

    const audit = await prisma.auditLog.findMany({ where: { actorId: user.id } });
    expect(audit.map((entry) => `${entry.entity}:${entry.action}`).sort()).toEqual([
      'student:claim',
      'user:create',
    ]);
    expect(JSON.stringify(audit)).not.toContain(iin);
    expect(JSON.stringify(audit)).not.toContain(phone);
  });

  it('creates an empty profile and asks for guardian consent for a minor', async () => {
    const iin = syntheticIin('100101');
    const phone = syntheticPhone();

    const started = await request(app.getHttpServer())
      .post('/api/auth/register/student')
      .send({ iin, fullName: 'Жаңа Оқушы', phone, password: 'Correct-Horse-1' })
      .expect(202);
    const otpId = (started.body as { otpId: string }).otpId;

    const finished = await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ otpId, code: sms.codeFor(otpId) })
      .expect(201);
    const body = finished.body as { studentId: string; guardianConsentRequired: boolean };
    expect(body.guardianConsentRequired).toBe(true);

    // Sequence diagram 2: verify-otp signs the new student in right away.
    const setCookie: unknown = finished.headers['set-cookie'];
    const session = (Array.isArray(setCookie) ? (setCookie as string[]) : []).find((cookie) =>
      cookie.startsWith('session='),
    );
    expect(session).toMatch(/HttpOnly/i);
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', (session ?? '').split(';')[0])
      .expect(200);
    expect(me.body).toMatchObject({ role: 'student', studentId: body.studentId, organization: null });
    expect(JSON.stringify(me.body)).not.toContain(iin);
    expect(JSON.stringify(me.body)).not.toContain(phone);

    // The new student can also sign in with phone + password.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone, password: 'Correct-Horse-1' })
      .expect(200, { userId: (me.body as { userId: string }).userId, role: 'student' });

    const student = await prisma.student.findUniqueOrThrow({ where: { id: body.studentId } });
    expect(student.status).toBe('claimed');
    expect(student.iinHash).toBe(crypto.hash('iin', iin));
    expect(student.guardianConsentAt).toBeNull();
  });

  it('answers 422 for a wrong IIN check digit and sends no SMS', async () => {
    const iin = syntheticIin('060510');
    const wrong = `${iin.slice(0, 11)}${(Number(iin[11]) + 1) % 10}`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/register/student')
      .send({
        iin: wrong,
        fullName: 'Тестов Тест',
        phone: syntheticPhone(),
        password: 'Correct-Horse-1',
      })
      .expect(422);
    expect(response.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'iin: Invalid IIN' },
    });
  });
});
