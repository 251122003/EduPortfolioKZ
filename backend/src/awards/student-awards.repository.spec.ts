import type { PrismaService } from '../prisma/prisma.service.js';
import { StudentAwardsRepository } from './student-awards.repository.js';

describe('StudentAwardsRepository', () => {
  const prisma = {
    student: { findUnique: vi.fn() },
    award: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const repository = new StudentAwardsRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds the student id by user id and selects nothing else', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
    await expect(repository.findStudentIdByUserId('user-1')).resolves.toBe(
      'student-1',
    );
    expect(prisma.student.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { id: true },
    });
  });

  it('returns null when the user has no student record', async () => {
    prisma.student.findUnique.mockResolvedValue(null);
    await expect(
      repository.findStudentIdByUserId('user-1'),
    ).resolves.toBeNull();
  });

  it('asks only for the student awards, newest event first, without personal fields', async () => {
    await repository.findByStudentId('student-1');
    const [args] = prisma.award.findMany.mock.calls[0] as [
      { where: unknown; orderBy: unknown; select: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ studentId: 'student-1' });
    expect(args.orderBy).toEqual([
      { event: { eventDate: 'desc' } },
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
    expect(args.select).not.toHaveProperty('student');
    expect(args.select).not.toHaveProperty('studentId');
    expect(args.select.changeRequests).toMatchObject({
      where: { type: 'revoke', status: 'approved' },
      take: 1,
      select: { reason: true },
    });
  });
});
