import type { ExamAttempt } from '@prisma/client';
import type { PrismaService } from '../../../../core/database/prisma.service';
import type { AccessibleExam } from '../../shared/domain/exam-access.repository';
import { PrismaLiveExamRepository } from './prisma-live-exam.repository';

const now = new Date('2030-01-01T10:00:00Z');
const authorizedExam: AccessibleExam = {
  id: '8dc198a1-1b0f-4fc1-914d-319917301f3e',
  name: 'Stale name',
  scope: 'PUBLIC',
  accessMode: 'OPEN',
  institutionId: null,
  startsAt: new Date('2030-01-01T09:00:00Z'),
  closesAt: new Date('2030-01-01T12:00:00Z'),
  durationMinutes: 120,
  maxAttempts: 3,
  passPercentage: 10,
  contentVersion: 1,
  status: 'RUNNING',
};

function transactionMock(
  current: Omit<
    AccessibleExam,
    'scope' | 'institutionId' | 'passPercentage'
  > & {
    passPercentage: number | null;
  },
) {
  const create = jest.fn().mockImplementation((args: { data: object }) =>
    Promise.resolve({
      ...args.data,
      id: '2fb48b3e-57f0-48ff-ac06-6b98821520a1',
      status: 'IN_PROGRESS',
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    } as ExamAttempt),
  );
  const queryRaw = jest
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ now }]);
  const tx = {
    $queryRaw: queryRaw,
    personalExam: { findFirst: jest.fn().mockResolvedValue(current) },
    examAttempt: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
      create,
    },
  };
  return { tx, create };
}

describe(PrismaLiveExamRepository.name, () => {
  it('retries and creates from the refreshed exam and database time', async () => {
    const current = {
      ...authorizedExam,
      name: 'Fresh name',
      durationMinutes: 30,
      maxAttempts: 1,
      passPercentage: 75,
      contentVersion: 2,
      closesAt: new Date('2030-01-01T10:20:00Z'),
    };
    const { tx, create } = transactionMock(current);
    const transaction = jest
      .fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce((callback) => callback(tx));
    const repository = new PrismaLiveExamRepository({
      $transaction: transaction,
    } as unknown as PrismaService);

    await expect(
      repository.startOrResume(authorizedExam, 'candidate-id', {
        ipAddress: '127.0.0.1',
      }),
    ).resolves.toMatchObject({
      examName: 'Fresh name',
      contentVersion: 2,
      passPercentage: 75,
      startedAt: now,
      expiresAt: current.closesAt,
    });

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        examName: 'Fresh name',
        contentVersion: 2,
        passPercentage: 75,
        startedAt: now,
        expiresAt: current.closesAt,
      }),
    });
  });

  it('rejects a newly invite-only exam authorized from an open snapshot', async () => {
    const current = { ...authorizedExam, accessMode: 'INVITE_ONLY' as const };
    const { tx, create } = transactionMock(current);
    const repository = new PrismaLiveExamRepository({
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    } as unknown as PrismaService);

    await expect(
      repository.startOrResume(authorizedExam, 'candidate-id', {}),
    ).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
