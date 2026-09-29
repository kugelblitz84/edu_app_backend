import { Injectable } from '@nestjs/common';
import type { ExamAttempt, ExamAttemptAnswer, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import type { AccessibleExam } from '../../shared/domain/exam-access.repository';
import {
  LiveExamRepository,
  type AttemptMetadata,
  type GradeAnswerUpdate,
  type GradeSummary,
} from '../domain/contracts/live-exam.repository';
import type {
  AttemptRecord,
  AttemptResult,
  AttemptWithAnswers,
  SavedAnswer,
} from '../domain/types/live-exam.types';

@Injectable()
export class PrismaLiveExamRepository implements LiveExamRepository {
  constructor(private readonly prisma: PrismaService) {}

  async startOrResume(
    exam: AccessibleExam,
    userId: string,
    metadata: AttemptMetadata,
  ): Promise<AttemptRecord | null> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.startOrResumeLocked(tx, exam, userId, metadata, false),
          { isolationLevel: 'ReadCommitted' },
        );
      } catch (error) {
        if (attempt === 3 || !this.isRetryableTransactionError(error)) {
          throw error;
        }
      }
    }
    return null;
  }

  async startOrResumePractice(
    exam: AccessibleExam,
    userId: string,
    metadata: AttemptMetadata,
  ): Promise<AttemptRecord | null> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.startOrResumeLocked(tx, exam, userId, metadata, true),
          { isolationLevel: 'ReadCommitted' },
        );
      } catch (error) {
        if (attempt === 3 || !this.isRetryableTransactionError(error)) {
          throw error;
        }
      }
    }
    return null;
  }

  private async startOrResumeLocked(
    tx: Prisma.TransactionClient,
    authorizedExam: AccessibleExam,
    userId: string,
    metadata: AttemptMetadata,
    isPractice: boolean,
  ): Promise<AttemptRecord | null> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${
      'exam:' + authorizedExam.id
    })) IS NULL AS locked`;
    const attemptKind = isPractice ? 'practice' : 'live';
    const lockKey = `${userId}:${authorizedExam.scope}:${authorizedExam.id}:${attemptKind}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})) IS NULL AS locked`;

    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`
      SELECT clock_timestamp() AS now
    `;
    const select = {
      id: true,
      name: true,
      accessMode: true,
      startsAt: true,
      closesAt: true,
      durationMinutes: true,
      maxAttempts: true,
      passPercentage: true,
      contentVersion: true,
      status: true,
    } as const;
    let exam: AccessibleExam | null;
    if (authorizedExam.scope === 'PUBLIC') {
      const current = await tx.personalExam.findFirst({
        where: { id: authorizedExam.id, deletedAt: null },
        select,
      });
      exam = current
        ? {
            ...current,
            scope: 'PUBLIC',
            institutionId: null,
            passPercentage:
              current.passPercentage === null
                ? null
                : Number(current.passPercentage),
          }
        : null;
    } else {
      const current = await tx.institutionExam.findFirst({
        where: {
          id: authorizedExam.id,
          deletedAt: null,
          institution: { status: 'ACTIVE' },
        },
        select: { ...select, institutionId: true },
      });
      exam = current
        ? {
            ...current,
            scope: 'INSTITUTIONAL',
            passPercentage:
              current.passPercentage === null
                ? null
                : Number(current.passPercentage),
          }
        : null;
    }

    const transactionNow = new Date(now);
    if (!exam) return null;
    const hasValidContent =
      !!exam.closesAt && !!exam.durationMinutes && exam.contentVersion >= 1;
    if (
      !hasValidContent ||
      (isPractice
        ? !['SCHEDULED', 'RUNNING', 'COMPLETED'].includes(exam.status) ||
          transactionNow < exam.closesAt!
        : !['SCHEDULED', 'RUNNING'].includes(exam.status) ||
          !exam.startsAt ||
          transactionNow < exam.startsAt ||
          transactionNow >= exam.closesAt! ||
          (exam.accessMode === 'INVITE_ONLY' &&
            authorizedExam.accessMode !== 'INVITE_ONLY'))
    ) {
      return null;
    }
    if (exam.scope === 'INSTITUTIONAL') {
      if (!exam.institutionId) return null;
      const enrollment = await tx.enrollment.findUnique({
        where: {
          institutionId_userId: {
            institutionId: exam.institutionId,
            userId,
          },
        },
        select: { status: true, expiresAt: true },
      });
      if (
        enrollment?.status !== 'ACTIVE' ||
        (enrollment.expiresAt !== null &&
          enrollment.expiresAt <= transactionNow)
      ) {
        return null;
      }
    }

    const active = await tx.examAttempt.findFirst({
      where: {
        userId,
        examId: exam.id,
        examScope: exam.scope,
        isPractice,
        status: 'IN_PROGRESS',
        expiresAt: { gt: transactionNow },
      },
      orderBy: { attemptNumber: 'desc' },
    });
    if (active) return this.toAttempt(active);

    await tx.examAttempt.updateMany({
      where: {
        userId,
        examId: exam.id,
        examScope: exam.scope,
        isPractice,
        status: 'IN_PROGRESS',
        expiresAt: { lte: transactionNow },
      },
      data: { status: 'AUTO_SUBMITTED', submittedAt: transactionNow },
    });
    const used = await tx.examAttempt.count({
      where: {
        userId,
        examId: exam.id,
        examScope: exam.scope,
        isPractice,
        status: { not: 'CANCELLED' },
      },
    });
    if (!isPractice && used >= exam.maxAttempts) return null;

    const durationEnd = new Date(
      transactionNow.getTime() + exam.durationMinutes! * 60_000,
    );
    const expiresAt =
      !isPractice && exam.closesAt! < durationEnd
        ? exam.closesAt!
        : durationEnd;
    const created = await tx.examAttempt.create({
      data: {
        userId,
        examId: exam.id,
        examScope: exam.scope,
        examName: exam.name,
        institutionId: exam.institutionId,
        contentVersion: exam.contentVersion,
        passPercentage: exam.passPercentage,
        isPractice,
        attemptNumber: used + 1,
        startedAt: transactionNow,
        expiresAt,
        lastActivityAt: transactionNow,
        startedIp: metadata.ipAddress?.slice(0, 45),
        userAgent: metadata.userAgent?.slice(0, 512),
      },
    });
    return this.toAttempt(created);
  }

  private isRetryableTransactionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: unknown; cause?: unknown };
    if (
      typeof candidate.code === 'string' &&
      ['P2034', '40001', '40P01'].includes(candidate.code)
    ) {
      return true;
    }
    return this.isRetryableTransactionError(candidate.cause);
  }

  async findOwned(
    attemptId: string,
    userId: string,
  ): Promise<AttemptWithAnswers | null> {
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, userId },
      include: { answers: true },
    });
    return attempt ? this.withAnswers(attempt) : null;
  }

  async findForGrading(attemptId: string): Promise<AttemptWithAnswers | null> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true },
    });
    return attempt ? this.withAnswers(attempt) : null;
  }

  saveAnswer(input: {
    attemptId: string;
    userId: string;
    questionId: string;
    selectedOptionIds: string[];
    revision: number;
    now: Date;
  }): Promise<{ revision: number; saved: boolean } | null> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.examAttempt.updateMany({
        where: {
          id: input.attemptId,
          userId: input.userId,
          status: 'IN_PROGRESS',
          expiresAt: { gt: input.now },
        },
        data: { lastActivityAt: input.now },
      });
      if (locked.count !== 1) return null;
      const existing = await tx.examAttemptAnswer.findUnique({
        where: {
          attemptId_questionId: {
            attemptId: input.attemptId,
            questionId: input.questionId,
          },
        },
      });
      if (existing && existing.revision >= input.revision) {
        return { revision: existing.revision, saved: false };
      }
      const answerData = {
        selectedOptionIds: input.selectedOptionIds,
      } satisfies Prisma.InputJsonValue;
      const answer = existing
        ? await tx.examAttemptAnswer.update({
            where: { id: existing.id },
            data: {
              answerData,
              revision: input.revision,
              answeredAt: input.now,
            },
          })
        : await tx.examAttemptAnswer.create({
            data: {
              attemptId: input.attemptId,
              questionId: input.questionId,
              answerData,
              revision: input.revision,
              answeredAt: input.now,
            },
          });
      return { revision: answer.revision, saved: true };
    });
  }

  async finalize(
    attemptId: string,
    userId: string,
    now: Date,
  ): Promise<AttemptRecord | null> {
    await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.examAttempt.findFirst({
        where: { id: attemptId, userId },
      });
      if (!attempt || attempt.status !== 'IN_PROGRESS') return;
      await tx.examAttempt.updateMany({
        where: { id: attemptId, userId, status: 'IN_PROGRESS' },
        data: {
          status: attempt.expiresAt <= now ? 'AUTO_SUBMITTED' : 'SUBMITTED',
          submittedAt: now,
          lastActivityAt: now,
        },
      });
    });
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, userId },
    });
    return attempt ? this.toAttempt(attempt) : null;
  }

  async claimExpired(now: Date, limit: number): Promise<AttemptRecord[]> {
    const candidates = await this.prisma.examAttempt.findMany({
      where: { status: 'IN_PROGRESS', expiresAt: { lte: now } },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });
    const claimed: AttemptRecord[] = [];
    for (const attempt of candidates) {
      const result = await this.prisma.examAttempt.updateMany({
        where: { id: attempt.id, status: 'IN_PROGRESS' },
        data: { status: 'AUTO_SUBMITTED', submittedAt: now },
      });
      if (result.count === 1) claimed.push(this.toAttempt(attempt));
    }
    return claimed;
  }

  async findPendingGrading(limit: number): Promise<AttemptRecord[]> {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } },
      orderBy: { submittedAt: 'asc' },
      take: limit,
    });
    return attempts.map((attempt) => this.toAttempt(attempt));
  }

  async persistGrade(
    attemptId: string,
    answers: GradeAnswerUpdate[],
    summary: GradeSummary,
  ): Promise<AttemptResult | null> {
    await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.examAttempt.findUnique({
        where: { id: attemptId },
      });
      if (
        !attempt ||
        !['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'].includes(attempt.status)
      )
        return;
      for (const answer of answers) {
        await tx.examAttemptAnswer.updateMany({
          where: { attemptId, questionId: answer.questionId },
          data: {
            isCorrect: answer.isCorrect,
            awardedMarks: answer.awardedMarks,
          },
        });
      }
      await tx.examAttemptResult.upsert({
        where: { attemptId },
        create: { attemptId, ...summary },
        update: summary,
      });
      await tx.examAttempt.update({
        where: { id: attemptId },
        data: { status: 'GRADED' },
      });
    });
    const result = await this.prisma.examAttemptResult.findUnique({
      where: { attemptId },
      include: { attempt: { select: { status: true } } },
    });
    return result
      ? {
          attemptId,
          status: result.attempt.status,
          score: Number(result.score),
          maximumScore: Number(result.maximumScore),
          percentage: Number(result.percentage),
          passed: result.passed,
          correctAnswers: result.correctAnswers,
          incorrectAnswers: result.incorrectAnswers,
          unanswered: result.unanswered,
          gradedAt: result.gradedAt,
        }
      : null;
  }

  async findResult(
    attemptId: string,
    userId: string,
  ): Promise<AttemptResult | null> {
    const result = await this.prisma.examAttemptResult.findFirst({
      where: { attemptId, attempt: { userId } },
      include: { attempt: { select: { status: true } } },
    });
    return result
      ? {
          attemptId,
          status: result.attempt.status,
          score: Number(result.score),
          maximumScore: Number(result.maximumScore),
          percentage: Number(result.percentage),
          passed: result.passed,
          correctAnswers: result.correctAnswers,
          incorrectAnswers: result.incorrectAnswers,
          unanswered: result.unanswered,
          gradedAt: result.gradedAt,
        }
      : null;
  }

  private toAttempt(attempt: ExamAttempt): AttemptRecord {
    return {
      ...attempt,
      passPercentage:
        attempt.passPercentage === null ? null : Number(attempt.passPercentage),
      examScope: attempt.examScope,
    };
  }

  private withAnswers(
    attempt: ExamAttempt & { answers: ExamAttemptAnswer[] },
  ): AttemptWithAnswers {
    return {
      ...this.toAttempt(attempt),
      answers: attempt.answers.map((answer) => this.toAnswer(answer)),
    };
  }

  private toAnswer(answer: ExamAttemptAnswer): SavedAnswer {
    const data = answer.answerData as { selectedOptionIds?: unknown };
    return {
      questionId: answer.questionId,
      answer: {
        selectedOptionIds: Array.isArray(data.selectedOptionIds)
          ? data.selectedOptionIds.filter(
              (value): value is string => typeof value === 'string',
            )
          : [],
      },
      revision: answer.revision,
    };
  }
}
