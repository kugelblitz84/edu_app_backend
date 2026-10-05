import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadAppConfig } from '../../src/core/config/app-config';
import { PrismaService } from '../../src/core/database/prisma.service';
import { PrismaLiveExamRepository } from '../../src/features/exams/exam-live/data/prisma-live-exam.repository';
import type { AccessibleExam } from '../../src/features/exams/shared/domain/exam-access.repository';
import { PrismaExamAccessRepository } from '../../src/features/exams/shared/data/prisma-exam-access.repository';

describe('exam attempt concurrency (PostgreSQL)', () => {
  jest.setTimeout(30_000);
  const baseConfig = loadAppConfig();
  const databaseName = `exam_concurrency_test_${randomUUID().replaceAll('-', '')}`;
  const databaseUrl = new URL(baseConfig.databaseUrl);
  databaseUrl.pathname = `/${databaseName}`;
  databaseUrl.searchParams.delete('schema');
  databaseUrl.searchParams.delete('options');
  const isolatedConfig = {
    ...baseConfig,
    databaseUrl: databaseUrl.toString(),
  };
  const adminPrisma = new PrismaService(baseConfig);
  const prisma = new PrismaService(isolatedConfig);
  const createdUserIds: string[] = [];
  const createdExamIds: string[] = [];

  beforeAll(async () => {
    await adminPrisma.$connect();
    if (!/^exam_concurrency_test_[a-f0-9]{32}$/.test(databaseName)) {
      throw new Error('Refusing to create an invalid test database name.');
    }
    await adminPrisma.$executeRawUnsafe(`CREATE DATABASE ${databaseName}`);
    try {
      execFileSync(
        process.execPath,
        [resolve('node_modules/prisma/build/index.js'), 'db', 'push'],
        {
          cwd: resolve('.'),
          env: {
            ...process.env,
            DATABASE_URL: isolatedConfig.databaseUrl,
          },
          stdio: 'pipe',
        },
      );
      await prisma.$connect();
    } catch (error) {
      await adminPrisma.$executeRawUnsafe(`DROP DATABASE ${databaseName}`);
      throw error;
    }
  });

  afterEach(async () => {
    if (createdExamIds.length > 0) {
      await prisma.examAttempt.deleteMany({
        where: { examId: { in: createdExamIds } },
      });
      await prisma.personalExam.deleteMany({
        where: { id: { in: createdExamIds } },
      });
      createdExamIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await adminPrisma.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS ${databaseName}`,
    );
    await adminPrisma.$disconnect();
  });

  async function createFixture(startsAt: Date) {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const [author, candidate] = await Promise.all([
      prisma.user.create({
        data: {
          email: `exam-author-${suffix}@example.com`,
          username: `exam_author_${suffix}`,
          passwordHash: 'integration-test-only',
          fullName: 'Exam Author',
        },
      }),
      prisma.user.create({
        data: {
          email: `exam-candidate-${suffix}@example.com`,
          username: `exam_user_${suffix}`,
          passwordHash: 'integration-test-only',
          fullName: 'Exam Candidate',
        },
      }),
    ]);
    createdUserIds.push(author.id, candidate.id);
    const exam = await prisma.personalExam.create({
      data: {
        name: `Concurrency ${suffix}`,
        createdByUserId: author.id,
        status: 'SCHEDULED',
        accessMode: 'OPEN',
        startsAt,
        closesAt: new Date(Date.now() + 10 * 60_000),
        durationMinutes: 60,
        maxAttempts: 1,
        contentVersion: 1,
      },
    });
    createdExamIds.push(exam.id);
    const accessible: AccessibleExam = {
      ...exam,
      scope: 'PUBLIC',
      institutionId: null,
      passPercentage:
        exam.passPercentage === null ? null : Number(exam.passPercentage),
    };
    return { exam, accessible, candidate };
  }

  it('returns one attempt for simultaneous starts by the same candidate', async () => {
    const { accessible, candidate } = await createFixture(
      new Date(Date.now() - 60_000),
    );
    const repository = new PrismaLiveExamRepository(prisma);

    const [first, second] = await Promise.all([
      repository.startOrResume(accessible, candidate.id, {}),
      repository.startOrResume(accessible, candidate.id, {}),
    ]);

    expect(first).not.toBeNull();
    expect(second?.id).toBe(first?.id);
    await expect(
      prisma.examAttempt.count({
        where: {
          examId: accessible.id,
          userId: candidate.id,
          examScope: 'PUBLIC',
        },
      }),
    ).resolves.toBe(1);
  });

  it('uses an edit committed while attempt creation waits for the exam lock', async () => {
    const startsAt = new Date(Date.now() + 500);
    const { exam, candidate } = await createFixture(startsAt);
    let releaseEditor!: () => void;
    let signalUpdated!: () => void;
    const editorRelease = new Promise<void>((resolve) => {
      releaseEditor = resolve;
    });
    const updated = new Promise<void>((resolve) => {
      signalUpdated = resolve;
    });
    const editor = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${
          'exam:' + exam.id
        })) IS NULL AS locked`;
        await tx.personalExam.update({
          where: { id: exam.id },
          data: { durationMinutes: 5, contentVersion: 2 },
        });
        signalUpdated();
        await editorRelease;
      },
      { timeout: 5_000 },
    );
    await updated;

    const waitUntilStart = startsAt.getTime() - Date.now() + 50;
    if (waitUntilStart > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitUntilStart));
    }
    const stale = await new PrismaExamAccessRepository(
      prisma,
    ).findExamForAccess(exam.id);
    expect(stale).toMatchObject({ durationMinutes: 60, contentVersion: 1 });

    const start = new PrismaLiveExamRepository(prisma).startOrResume(
      stale!,
      candidate.id,
      {},
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    releaseEditor();
    await editor;
    const attempt = await start;

    expect(attempt).toMatchObject({
      contentVersion: 2,
      examName: exam.name,
    });
    expect(attempt!.expiresAt.getTime() - attempt!.startedAt.getTime()).toBe(
      5 * 60_000,
    );
  });
});
