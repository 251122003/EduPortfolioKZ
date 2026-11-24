import { UnauthorizedException } from '@nestjs/common';
import type {
  StudentAwardRow,
  StudentAwardsRepository,
} from './student-awards.repository.js';
import { StudentAwardsService } from './student-awards.service.js';

function row(overrides: Partial<StudentAwardRow> = {}): StudentAwardRow {
  return {
    id: 'award-1',
    type: 'diploma',
    place: 1,
    documentNumber: 'DOC-1',
    status: 'active',
    event: {
      title: 'Regional Mathematics Olympiad 2026',
      subject: 'mathematics',
      eventDate: new Date('2026-10-15T00:00:00.000Z'),
      level: 'regional',
      organization: { name: 'Demo Olympiad Center', status: 'verified' },
    },
    changeRequests: [],
    ...overrides,
  };
}

describe('StudentAwardsService', () => {
  const repository = {
    findStudentIdByUserId: vi.fn(),
    findByStudentId: vi.fn(),
  };
  const service = new StudentAwardsService(
    repository as unknown as StudentAwardsRepository,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findStudentIdByUserId.mockResolvedValue('student-1');
  });

  it('returns the awards of the student linked to the user', async () => {
    repository.findByStudentId.mockResolvedValue([row()]);

    await expect(service.listForUser('user-1')).resolves.toEqual({
      awards: [
        {
          id: 'award-1',
          type: 'diploma',
          place: 1,
          documentNumber: 'DOC-1',
          status: 'active',
          revokeReason: null,
          event: {
            title: 'Regional Mathematics Olympiad 2026',
            subject: 'mathematics',
            date: '2026-10-15',
            level: 'regional',
          },
          organization: { name: 'Demo Olympiad Center', status: 'verified' },
        },
      ],
    });
    expect(repository.findStudentIdByUserId).toHaveBeenCalledWith('user-1');
    expect(repository.findByStudentId).toHaveBeenCalledWith('student-1');
  });

  it('keeps the order given by the repository', async () => {
    repository.findByStudentId.mockResolvedValue([
      row({ id: 'new' }),
      row({ id: 'old' }),
    ]);
    const { awards } = await service.listForUser('user-1');
    expect(awards.map((a) => a.id)).toEqual(['new', 'old']);
  });

  it('shows the revoke reason only for a revoked award', async () => {
    const reason = [{ reason: 'Duplicate diploma' }];
    repository.findByStudentId.mockResolvedValue([
      row({ id: 'revoked', status: 'revoked', changeRequests: reason }),
      row({ id: 'revoked-no-request', status: 'revoked' }),
      row({ id: 'corrected', status: 'corrected', changeRequests: reason }),
    ]);
    const { awards } = await service.listForUser('user-1');
    expect(awards.map((a) => [a.id, a.status, a.revokeReason])).toEqual([
      ['revoked', 'revoked', 'Duplicate diploma'],
      ['revoked-no-request', 'revoked', null],
      ['corrected', 'corrected', null],
    ]);
  });

  it('returns an empty list for a student without awards', async () => {
    repository.findByStudentId.mockResolvedValue([]);
    await expect(service.listForUser('user-1')).resolves.toEqual({
      awards: [],
    });
  });

  it('never puts personal or encrypted fields into the answer', async () => {
    // Even if a row carried extra columns, only the listed fields are copied.
    const leaky = {
      ...row(),
      studentId: 'student-1',
      iinHash: 'x',
      phoneEncrypted: new Uint8Array([1]),
      fullName: 'Name',
    } as StudentAwardRow;
    repository.findByStudentId.mockResolvedValue([leaky]);
    const json = JSON.stringify(await service.listForUser('user-1'));
    expect(json).not.toMatch(/iin|phone|fullName|encrypted|hash|studentId/i);
  });

  it('answers 401 when the user has no student record', async () => {
    repository.findStudentIdByUserId.mockResolvedValue(null);
    const error: unknown = await service
      .listForUser('ghost')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getResponse()).toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(repository.findByStudentId).not.toHaveBeenCalled();
  });
});
