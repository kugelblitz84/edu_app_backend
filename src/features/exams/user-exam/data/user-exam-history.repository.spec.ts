import { PrismaUserExamRepository } from './user-exam.repository';
import type { PrismaService } from '../../../../core/database/prisma.service';
import type { AuthenticatedUser } from '../../../../core/auth/auth.types';

const viewer = {
  userId: 'viewer',
  platformRole: 'PLATFORM_USER',
} as AuthenticatedUser;
const row = {
  id: 'attempt',
  examId: 'exam',
  examScope: 'PUBLIC',
  examName: 'Math',
  institutionId: null,
  contentVersion: 1,
  isPractice: false,
  attemptNumber: 1,
  status: 'GRADED',
  startedAt: new Date(),
  expiresAt: new Date(),
  submittedAt: new Date(),
  result: {
    score: '8',
    maximumScore: '10',
    percentage: '80',
    passed: true,
    correctAnswers: 8,
    incorrectAnswers: 2,
    unanswered: 0,
    gradedAt: new Date(),
  },
};
function setup() {
  const prisma = {
    institutionAdmin: {
      findMany: jest.fn().mockResolvedValue([{ institutionId: 'managed' }]),
    },
    examAttempt: {
      findMany: jest.fn().mockResolvedValue([row]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(row),
    },
    examAttemptAnswer: {
      findMany: jest.fn().mockResolvedValue([
        {
          attemptId: 'attempt',
          questionId: 'question',
          answerData: { selected: 'a' },
          isCorrect: true,
          awardedMarks: '1',
          answeredAt: new Date(),
        },
      ]),
    },
    $transaction: jest.fn((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    ),
  };
  return {
    prisma,
    repository: new PrismaUserExamRepository(
      prisma as unknown as PrismaService,
    ),
  };
}
describe('Exam history visibility', () => {
  it('limits other users history before pagination and omits answers and detailed results', async () => {
    const { prisma, repository } = setup();
    const result = await repository.findHistory('owner', viewer, {
      page: 2,
      limit: 10,
    });
    expect(prisma.examAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'owner',
          OR: [
            { examScope: 'PUBLIC' },
            { examScope: 'INSTITUTIONAL', institutionId: { in: ['managed'] } },
          ],
        },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.list[0].totalScore).toBe(8);
    expect(result.list[0]).not.toHaveProperty('answers');
    expect(result.list[0]).not.toHaveProperty('result');
    expect(prisma.examAttemptAnswer.findMany).not.toHaveBeenCalled();
  });
  it.each([
    { ...viewer, userId: 'owner' },
    { ...viewer, platformRole: 'GLOBAL_ADMIN' as const },
  ])('returns full details to owners and global admins', async (actor) => {
    const { prisma, repository } = setup();
    const item = await repository.findAttempt('owner', 'attempt', actor);
    expect(prisma.examAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'owner', id: 'attempt' } }),
    );
    expect(item?.answers?.[0].awardedMarks).toBe(1);
    expect(item?.result?.percentage).toBe(80);
    expect(prisma.institutionAdmin.findMany).not.toHaveBeenCalled();
  });
  it('returns full details for an administered institution', async () => {
    const { prisma, repository } = setup();
    prisma.examAttempt.findFirst.mockResolvedValue({
      ...row,
      examScope: 'INSTITUTIONAL',
      institutionId: 'managed',
    });
    expect(
      (await repository.findAttempt('owner', 'attempt', viewer))?.answers,
    ).toHaveLength(1);
  });
  it('does not return an inaccessible or missing attempt', async () => {
    const { prisma, repository } = setup();
    prisma.examAttempt.findFirst.mockResolvedValue(null);
    expect(await repository.findAttempt('owner', 'hidden', viewer)).toBeNull();
    expect(prisma.examAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'owner',
          id: 'hidden',
          OR: expect.any(Array) as unknown,
        }) as unknown,
      }),
    );
    expect(prisma.examAttemptAnswer.findMany).not.toHaveBeenCalled();
  });
});
