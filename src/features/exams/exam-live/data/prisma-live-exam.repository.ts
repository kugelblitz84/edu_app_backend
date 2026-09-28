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

  startOrResume(
    exam: AccessibleExam,
    userId: string,
    now: Date,
    metadata: AttemptMetadata,
  ): Promise<AttemptRecord | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const lockKey = `${userId}:${exam.scope}:${exam.id}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        const active = await tx.examAttempt.findFirst({
          where: {
            userId,
            examId: exam.id,
            examScope: exam.scope,
            status: 'IN_PROGRESS',
            expiresAt: { gt: now },
          },
          orderBy: { attemptNumber: 'desc' },
        });
        if (active) return this.toAttempt(active);

        await tx.examAttempt.updateMany({
          where: {
            userId,
            examId: exam.id,
            examScope: exam.scope,
            status: 'IN_PROGRESS',
            expiresAt: { lte: now },
          },
          data: { status: 'AUTO_SUBMITTED', submittedAt: now },
        });
        const used = await tx.examAttempt.count({
          where: {
            userId,
            examId: exam.id,
            examScope: exam.scope,
            status: { not: 'CANCELLED' },
          },
        });
        if (used >= exam.maxAttempts) return null;
        const durationEnd = new Date(
          now.getTime() + (exam.durationMinutes ?? 0) * 60_000,
        );
        const expiresAt =
          exam.closesAt && exam.closesAt < durationEnd
            ? exam.closesAt
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
            attemptNumber: used + 1,
            startedAt: now,
            expiresAt,
            lastActivityAt: now,
            startedIp: metadata.ipAddress?.slice(0, 45),
            userAgent: metadata.userAgent?.slice(0, 512),
          },
        });
        return this.toAttempt(created);
      },
      { isolationLevel: 'Serializable' },
    );
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
