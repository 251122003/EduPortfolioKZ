// Demo data for local development: `npx prisma db seed`.
// Everything here is SYNTHETIC: the IINs have valid check digits but belong to nobody,
// the phones are fictional and the organization does not exist.
// Safe to run again: existing rows are found by their unique keys and left as they are.

import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { IdentityCrypto, normalizePhone } from '../src/common/identity/identity-crypto.js';
import { iinCheckDigit } from '../src/common/identity/iin.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the environment.
}

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'Demo-Password-2026';

interface DemoStudent {
  first11: string; // YYMMDD + century/sex digit + serial; the check digit is computed
  fullName: string;
  phone: string;
}

const STUDENTS: DemoStudent[] = [
  { first11: '08031560001', fullName: 'Сейтқали Аружан', phone: '+7 701 000 00 01' },
  { first11: '09070250002', fullName: 'Ахметов Данияр', phone: '+7 701 000 00 02' },
  { first11: '06112060003', fullName: 'Нұрланова Әлия', phone: '+7 701 000 00 03' },
];

function syntheticIin(first11: string): string {
  const check = iinCheckDigit(first11);
  if (check === null) {
    throw new Error(`Pick another serial: ${first11} has no valid check digit`);
  }
  return `${first11}${check}`;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to backend/.env');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const crypto = IdentityCrypto.fromEnv();
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  try {
    // 1. Admin
    const admin = await prisma.user.upsert({
      where: { login: 'admin@eduportfolio.test' },
      update: {},
      create: { role: 'admin', login: 'admin@eduportfolio.test', passwordHash },
    });

    // 2. Verified organization and its staff account
    const organization = await prisma.organization.upsert({
      where: { bin: '260140000001' },
      update: {},
      create: {
        name: 'Demo Olympiad Center',
        bin: '260140000001',
        type: 'education_center',
        status: 'verified',
        contact: 'contact@olympiad.test',
      },
    });
    const orgUser = await prisma.user.upsert({
      where: { login: 'org@eduportfolio.test' },
      update: {},
      create: {
        role: 'organization',
        login: 'org@eduportfolio.test',
        passwordHash,
        organizationId: organization.id,
      },
    });

    // 3. Unclaimed student records, the way an organization creates them in UC-2
    const students = [];
    for (const demo of STUDENTS) {
      const iin = syntheticIin(demo.first11);
      const phone = normalizePhone(demo.phone);
      if (phone === null) {
        throw new Error(`Bad demo phone ${demo.phone}`);
      }
      const student = await prisma.student.upsert({
        where: { iinHash: crypto.hash('iin', iin) },
        update: {},
        create: {
          iinHash: crypto.hash('iin', iin),
          iinEncrypted: crypto.encrypt(iin),
          phoneHash: crypto.hash('phone', phone),
          phoneEncrypted: crypto.encrypt(phone),
          fullName: demo.fullName,
        },
      });
      students.push(student);
    }

    // 4. One event
    const eventTitle = 'Regional Mathematics Olympiad 2026';
    const event =
      (await prisma.event.findFirst({
        where: { organizationId: organization.id, title: eventTitle },
      })) ??
      (await prisma.event.create({
        data: {
          organizationId: organization.id,
          title: eventTitle,
          eventDate: new Date('2026-10-15'),
          level: 'regional',
          subject: 'mathematics',
        },
      }));

    // 5. Awards: each new one gets an audit entry and an AI review job, as in UC-2 step 5
    const awards = [
      { student: students[0], place: 1, type: 'diploma', documentNumber: 'DEMO-2026-001', status: 'active' },
      { student: students[1], place: 2, type: 'diploma', documentNumber: 'DEMO-2026-002', status: 'active' },
      { student: students[2], place: null, type: 'certificate', documentNumber: 'DEMO-2026-003', status: 'active' },
      { student: students[0], place: 3, type: 'diploma', documentNumber: 'DEMO-2026-004', status: 'revoked' },
    ] as const;

    let created = 0;
    for (const item of awards) {
      const existing = await prisma.award.findUnique({
        where: {
          organizationId_documentNumber: {
            organizationId: organization.id,
            documentNumber: item.documentNumber,
          },
        },
      });
      if (existing) {
        continue;
      }
      await prisma.$transaction(async (tx) => {
        const award = await tx.award.create({
          data: {
            organizationId: organization.id,
            eventId: event.id,
            studentId: item.student.id,
            place: item.place,
            type: item.type,
            documentNumber: item.documentNumber,
            status: item.status,
            createdBy: orgUser.id,
          },
        });
        // Audit entries never contain IIN, phone or full name.
        await tx.auditLog.create({
          data: {
            actorId: orgUser.id,
            entity: 'award',
            entityId: award.id,
            action: 'create',
            after: { documentNumber: award.documentNumber, status: award.status, place: award.place },
          },
        });
        await tx.aiJob.create({ data: { awardId: award.id } });
      });
      created += 1;
    }

    console.log('Seed finished.');
    console.log(`  admin:        ${admin.login}`);
    console.log(`  organization: ${orgUser.login} (${organization.name})`);
    console.log(`  students:     ${students.length}, awards created now: ${created}`);
    console.log(`  password for both accounts: ${DEMO_PASSWORD} (local demo data only)`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
