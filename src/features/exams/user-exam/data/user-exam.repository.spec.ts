import type { PrismaService } from '../../../../core/database/prisma.service';
import { PrismaUserExamRepository } from './user-exam.repository';

describe(PrismaUserExamRepository.name, () => {
  it('applies public filters, stable ordering, and pagination', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const transaction = jest
      .fn()
      .mockImplementation((queries: Promise<unknown>[]) =>
        Promise.all(queries),
      );
    const prisma = {
      personalExam: { findMany, count },
      $transaction: transaction,
    } as unknown as PrismaService;
    const repository = new PrismaUserExamRepository(prisma);

    await expect(
      repository.findPublicExams({
        page: 3,
        limit: 10,
        status: 'RUNNING',
        prefix: 'Math',
        orderBy: 'name',
        order: 'asc',
      }),
    ).resolves.toEqual({ list: [], total: 0 });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        status: 'RUNNING',
        name: { startsWith: 'Math', mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        description: true,
        startsAt: true,
        closesAt: true,
        durationMinutes: true,
        status: true,
        accessMode: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 20,
      take: 10,
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        status: 'RUNNING',
        name: { startsWith: 'Math', mode: 'insensitive' },
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('returns the total institution exam count independently of the page', async () => {
    const exam = {
      id: '8dc198a1-1b0f-4fc1-914d-319917301f3e',
      status: 'SCHEDULED',
      accessMode: 'OPEN',
    };
    const findMany = jest.fn().mockResolvedValue([exam]);
    const count = jest.fn().mockResolvedValue(21);
    const transaction = jest
      .fn()
      .mockImplementation((queries: Promise<unknown>[]) =>
        Promise.all(queries),
      );
    const prisma = {
      institutionExam: { findMany, count },
      $transaction: transaction,
    } as unknown as PrismaService;
    const repository = new PrismaUserExamRepository(prisma);

    await expect(
      repository.findInstitutionExams('1030af05-ed3a-4327-8c99-17acc15f2eb6', {
        page: 2,
        limit: 10,
      }),
    ).resolves.toEqual({
      list: [{ ...exam, scope: 'INSTITUTIONAL' }],
      total: 21,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        institutionId: '1030af05-ed3a-4327-8c99-17acc15f2eb6',
        deletedAt: null,
        status: { in: ['SCHEDULED', 'RUNNING'] },
        institution: {
          status: 'ACTIVE',
        },
      },
    });
  });
});
