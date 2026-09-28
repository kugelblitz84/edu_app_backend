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
  const institutionFindFirst = jest.fn();
  const userFindMany = jest.fn();
  const prisma = {
    personalExam: { findFirst: personalFindFirst },
    institutionExam: { findFirst: institutionFindFirst },
    user: { findMany: userFindMany },
  } as unknown as PrismaService;

  return {
    repository: new PrismaMongoExamRepository(prisma, {} as MongooseService),
    personalFindFirst,
    institutionFindFirst,
    userFindMany,
  };
}

describe(PrismaMongoExamRepository.name, () => {
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
});
