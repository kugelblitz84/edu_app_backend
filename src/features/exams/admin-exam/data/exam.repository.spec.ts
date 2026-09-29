import type { MongooseService } from '../../../../core/database/mongoose.service';
import type { PrismaService } from '../../../../core/database/prisma.service';
import { PrismaMongoExamRepository } from './exam.repository';

const exam = {
  id: '8dc198a1-1b0f-4fc1-914d-319917301f3e',
  name: 'Final',
  description: null,
  startsAt: null,
  closesAt: null,
  durationMinutes: null,
  maxAttempts: 1,
  passPercentage: null,
  contentVersion: 0,
  status: 'DRAFT' as const,
  accessMode: 'OPEN' as const,
  createdByUserId: '2f273fc1-674b-4763-972c-16a87eb8a616',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
};

function repositoryMock() {
  const personalFindFirst = jest.fn();
  const personalCreate = jest.fn();
  const institutionFindFirst = jest.fn();
  const institutionCreate = jest.fn();
  const adminFindUnique = jest.fn();
  const userFindMany = jest.fn();
  const prisma = {
    personalExam: { findFirst: personalFindFirst, create: personalCreate },
    institutionExam: {
      findFirst: institutionFindFirst,
      create: institutionCreate,
    },
    institutionAdmin: { findUnique: adminFindUnique },
    user: { findMany: userFindMany },
  } as unknown as PrismaService;

  return {
    repository: new PrismaMongoExamRepository(prisma, {} as MongooseService),
    personalFindFirst,
    personalCreate,
    institutionFindFirst,
    institutionCreate,
    adminFindUnique,
    userFindMany,
  };
}

describe(PrismaMongoExamRepository.name, () => {
  it('persists invite-only access for public and institutional drafts', async () => {
    const { repository, personalCreate, institutionCreate, adminFindUnique } =
      repositoryMock();
    personalCreate.mockResolvedValue({ ...exam, accessMode: 'INVITE_ONLY' });
    adminFindUnique.mockResolvedValue({
      institution: { status: 'ACTIVE' },
    });
    institutionCreate.mockResolvedValue({
      ...exam,
      institutionId: 'ed52b4d1-b69a-4705-bd3f-f946170a4813',
      accessMode: 'INVITE_ONLY',
    });

    await repository.createDraft({
      scope: 'PUBLIC',
      name: exam.name,
      createdByUserId: exam.createdByUserId,
      accessMode: 'INVITE_ONLY',
    });
    await repository.createDraft({
      scope: 'INSTITUTIONAL',
      institutionId: 'ed52b4d1-b69a-4705-bd3f-f946170a4813',
      name: exam.name,
      createdByUserId: exam.createdByUserId,
      accessMode: 'INVITE_ONLY',
    });

    expect(personalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ accessMode: 'INVITE_ONLY' }),
    });
    expect(institutionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ accessMode: 'INVITE_ONLY' }),
    });
  });

  it('only exposes a public exam to its author for editing', async () => {
    const { repository, personalFindFirst, institutionFindFirst } =
      repositoryMock();
    personalFindFirst.mockResolvedValue(null);
    institutionFindFirst.mockResolvedValue(null);

    await expect(
      repository.findAccessibleById(exam.id, 'different-user-id'),
    ).resolves.toBeNull();

    expect(personalFindFirst).toHaveBeenCalledWith({
      where: {
        id: exam.id,
        createdByUserId: 'different-user-id',
        deletedAt: null,
      },
    });
  });

  it('exposes an institutional exam to another active institution admin', async () => {
    const { repository, personalFindFirst, institutionFindFirst } =
      repositoryMock();
    const adminId = '9c45926e-fab7-4873-b219-02330fba39b8';
    personalFindFirst.mockResolvedValue(null);
    institutionFindFirst.mockResolvedValue({
      ...exam,
      institutionId: 'ed52b4d1-b69a-4705-bd3f-f946170a4813',
    });

    await expect(
      repository.findAccessibleById(exam.id, adminId),
    ).resolves.toMatchObject({
      id: exam.id,
      scope: 'INSTITUTIONAL',
    });

    expect(institutionFindFirst).toHaveBeenCalledWith({
      where: {
        id: exam.id,
        deletedAt: null,
        institution: {
          status: 'ACTIVE',
          admins: { some: { userId: adminId } },
        },
      },
    });
  });

  it('resolves all active candidate emails in one user ID query', async () => {
    const { repository, userFindMany } = repositoryMock();
    const userIds = [
      '2f273fc1-674b-4763-972c-16a87eb8a616',
      '9c45926e-fab7-4873-b219-02330fba39b8',
    ];
    userFindMany.mockResolvedValue([]);

    await repository.findActiveCandidatesByIds(userIds);

    expect(userFindMany).toHaveBeenCalledTimes(1);
    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: userIds },
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true, email: true },
    });
  });

  it('refuses metadata changes after the first attempt under the exam lock', async () => {
    const updateMany = jest.fn();
    const transaction = jest.fn().mockImplementation(async (callback) =>
      callback({
        $queryRaw: jest.fn(),
        examAttempt: { count: jest.fn().mockResolvedValue(1) },
        personalExam: {
          findFirst: jest.fn().mockResolvedValue(exam),
          updateMany,
        },
      }),
    );
    const repository = new PrismaMongoExamRepository(
      { $transaction: transaction } as unknown as PrismaService,
      {} as MongooseService,
    );

    await expect(
      repository.updateMetadata(exam.id, 'PUBLIC', exam.createdByUserId, {
        maxAttempts: 2,
      }),
    ).resolves.toBeNull();

    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    [{ closesAt: null }, 'a null closing time'],
    [{ durationMinutes: null }, 'a null duration'],
    [
      { closesAt: new Date('2030-01-01T09:00:00Z') },
      'a closing time before the start',
    ],
  ])('rejects scheduled metadata resulting in %s', async (input) => {
    jest.useFakeTimers().setSystemTime(new Date('2029-01-01T00:00:00Z'));
    const scheduledExam = {
      ...exam,
      status: 'SCHEDULED' as const,
      startsAt: new Date('2030-01-01T10:00:00Z'),
      closesAt: new Date('2030-01-01T12:00:00Z'),
      durationMinutes: 60,
      contentVersion: 1,
    };
    const updateMany = jest.fn();
    const tx = {
      $queryRaw: jest.fn(),
      personalExam: {
        findFirst: jest.fn().mockResolvedValue(scheduledExam),
        updateMany,
      },
      examAttempt: { count: jest.fn().mockResolvedValue(0) },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    } as unknown as PrismaService;
    const repository = new PrismaMongoExamRepository(
      prisma,
      {} as MongooseService,
    );

    await expect(
      repository.updateMetadata(exam.id, 'PUBLIC', exam.createdByUserId, input),
    ).resolves.toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('publishes the token-owned Mongo version selected by scheduling', async () => {
    const mongoUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    });
    const mongoCreate = jest.fn().mockImplementation((data) =>
      Promise.resolve({
        toObject: () => data,
      }),
    );
    const model = {
      deleteOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      }),
      create: mongoCreate,
      updateOne: mongoUpdate,
    };
    const scheduled = {
      ...exam,
      status: 'SCHEDULED',
      startsAt: new Date('2030-01-01T10:00:00Z'),
      closesAt: new Date('2030-01-01T12:00:00Z'),
      durationMinutes: 60,
      contentVersion: 1,
    };
    const tx = {
      $queryRaw: jest.fn(),
      personalExam: {
        findFirst: jest.fn().mockResolvedValue(exam),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(scheduled),
      },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    } as unknown as PrismaService;
    const mongoose = {
      connection: { models: { ExamData: model } },
    } as unknown as MongooseService;
    const repository = new PrismaMongoExamRepository(prisma, mongoose);

    await expect(
      repository.scheduleDraft(exam.id, 'PUBLIC', exam.createdByUserId, {
        startsAt: scheduled.startsAt,
        closesAt: scheduled.closesAt,
        durationMinutes: 60,
        maxAttempts: 1,
        questions: [
          {
            question: '2 + 2?',
            options: ['3', '4'],
            correctAnswer: '4',
            markValue: 1,
          },
        ],
        contentVersion: 1,
      }),
    ).resolves.toMatchObject({ status: 'SCHEDULED', contentVersion: 1 });

    const pending = mongoCreate.mock.calls[0][0] as {
      publicationId: string;
    };
    expect(mongoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ publicationId: pending.publicationId }),
      { $set: { publicationState: 'PUBLISHED' } },
    );
  });
});
