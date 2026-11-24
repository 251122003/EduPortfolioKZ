import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { StudentAwardsResponse } from '../src/awards/awards.types.js';
import {
  IdentityCrypto,
  normalizePhone,
} from '../src/common/identity/identity-crypto.js';
import { iinCheckDigit } from '../src/common/identity/iin.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// End-to-end test of GET /api/me/awards (FR-12) against the real local database from backend/.env.
// Needs the demo data (`npx prisma db seed`) for the organization account.
// Every run creates its own SYNTHETIC organization, students and awards, because awards and
// the audit log cannot be deleted.
const ORG_LOGIN = 'org@eduportfolio.test';
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Demo-Password-2026';
const STUDENT_PASSWORD = 'Correct-Horse-1';

function syntheticIin(): string {
  for (;;) {
    const first11 = `070101${randomInt(0, 100_000).toString().padStart(5, '0')}`;
    const check = iinCheckDigit(first11);
    if (check !== null) {
      return `${first11}${check}`;
    }
  }
}

function syntheticPhone(): string {
  return `+7709${randomInt(0, 10_000_000).toString().padStart(7, '0')}`;
}

function cookieFrom(response: request.Response): string {
  const header: unknown = response.headers['set-cookie'];
  const cookies = Array.isArray(header)
    ? header.filter((c): c is string => typeof c === 'string')
    : [];
  const session = cookies.find((cookie) => cookie.startsWith('session='));
  if (session === undefined) {
    throw new Error('No session cookie in the response');
  }
  return session.split(';')[0];
}

describe('Student awards (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let crypto: IdentityCrypto;
  const run = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    crypto = app.get(IdentityCrypto);
  });

  afterAll(async () => {
    await app.close();
  });

  /** A claimed student with a password, the way verify-otp leaves it. */
  async function createStudent(
    passwordHash: string,
  ): Promise<{ id: string; phone: string; iin: string }> {
    const iin = syntheticIin();
    const phone = syntheticPhone();
    const normalized = normalizePhone(phone);
    if (normalized === null) {
      throw new Error('Bad synthetic phone');
    }
    const user = await prisma.user.create({
      data: { role: 'student', passwordHash },
    });
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        status: 'claimed',
        iinHash: crypto.hash('iin', iin),
        iinEncrypted: crypto.encrypt(iin),
        phoneHash: crypto.hash('phone', normalized),
        phoneEncrypted: crypto.encrypt(normalized),
        fullName: 'Тестов Тест',
      },
    });
    return { id: student.id, phone, iin };
  }

  it('shows a student only own awards, newest event first, with the revoke reason', async () => {
    const passwordHash = await argon2.hash(STUDENT_PASSWORD);
    const organization = await prisma.organization.create({
      data: {
        name: `E2E Center ${run}`,
        bin: `9${randomInt(0, 100_000_000_000).toString().padStart(11, '0')}`,
        type: 'education_center',
        status: 'verified',
        contact: 'e2e@olympiad.test',
      },
    });
    const staff = await prisma.user.create({
      data: {
        role: 'organization',
        login: `e2e-${run}@eduportfolio.test`,
        passwordHash,
        organizationId: organization.id,
      },
    });
    const older = await prisma.event.create({
      data: {
        organizationId: organization.id,
        title: 'Older Olympiad',
        eventDate: new Date('2025-03-01'),
        level: 'school',
        subject: 'physics',
      },
    });
    const newer = await prisma.event.create({
      data: {
        organizationId: organization.id,
        title: 'Newer Olympiad',
        eventDate: new Date('2026-04-20'),
        level: 'national',
        subject: 'chemistry',
      },
    });

    const me = await createStudent(passwordHash);
    const other = await createStudent(passwordHash);

    const award = (
      eventId: string,
      studentId: string,
      doc: string,
      status: 'active' | 'revoked',
    ) =>
      prisma.award.create({
        data: {
          organizationId: organization.id,
          eventId,
          studentId,
          place: 1,
          type: 'diploma',
          documentNumber: `E2E-${run}-${doc}`,
          status,
          createdBy: staff.id,
        },
      });
    // Created in the "wrong" order, so the test checks sorting by event date.
    await award(older.id, me.id, 'OLD', 'active');
    const revoked = await award(newer.id, me.id, 'NEW', 'revoked');
    await award(newer.id, other.id, 'OTHER', 'active');
    await prisma.changeRequest.create({
      data: {
        awardId: revoked.id,
        requestedBy: staff.id,
        type: 'revoke',
        reason: 'Entered by mistake',
        status: 'approved',
        reviewedAt: new Date(),
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: me.phone, password: STUDENT_PASSWORD })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/me/awards')
      .set('Cookie', cookieFrom(login))
      .expect(200);
    const body = response.body as StudentAwardsResponse;

    expect(body).toEqual({
      awards: [
        {
          id: revoked.id,
          type: 'diploma',
          place: 1,
          documentNumber: `E2E-${run}-NEW`,
          status: 'revoked',
          revokeReason: 'Entered by mistake',
          event: {
            title: 'Newer Olympiad',
            subject: 'chemistry',
            date: '2026-04-20',
            level: 'national',
          },
          organization: { name: `E2E Center ${run}`, status: 'verified' },
        },
        {
          id: expect.any(String),
          type: 'diploma',
          place: 1,
          documentNumber: `E2E-${run}-OLD`,
          status: 'active',
          revokeReason: null,
          event: {
            title: 'Older Olympiad',
            subject: 'physics',
            date: '2025-03-01',
            level: 'school',
          },
          organization: { name: `E2E Center ${run}`, status: 'verified' },
        },
      ],
    });

    const raw = JSON.stringify(body);
    expect(raw).not.toContain(me.iin);
    expect(raw).not.toContain(me.phone.slice(1));
    expect(raw).not.toContain(me.id);
    expect(raw).not.toContain('Тестов');
  });

  it('answers 403 FORBIDDEN to an organization account', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: ORG_LOGIN, password: SEED_PASSWORD })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/me/awards')
      .set('Cookie', cookieFrom(login))
      .expect(403);
    expect(response.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    });
  });

  it('answers 401 UNAUTHORIZED without a session', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/me/awards')
      .expect(401);
    expect(response.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Sign in required' },
    });
  });
});
