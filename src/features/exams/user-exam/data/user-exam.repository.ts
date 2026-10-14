import type { AuthenticatedUser } from '../../../../core/auth/auth.types';
import type {
  ExamHistoryQuery,
  ExamAttemptHistoryItem,
} from '../domain/user-exam.contracts';
import { Injectable } from '@nestjs/common';
import { ExamStatus as PrismaExamStatus } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import type { Prisma } from '@prisma/client';
import {
  UserExamRepository,
  type AccessibleExam,
  type InstitutionExamQuery,
  type InstitutionExamPage,
  type PublicExamPage,
  type PublicExamQuery,
  type PublicExamStatus,
} from '../domain/user-exam.contracts';

const historySelect = {
  id: true,
  examId: true,
  examScope: true,
  examName: true,
  institutionId: true,
  contentVersion: true,
  isPractice: true,
  attemptNumber: true,
  status: true,
  startedAt: true,
  expiresAt: true,
  submittedAt: true,
  result: {
    select: {
      score: true,
      maximumScore: true,
      percentage: true,
      passed: true,
      correctAnswers: true,
      incorrectAnswers: true,
      unanswered: true,
      gradedAt: true,
    },
  },
} as const satisfies Prisma.ExamAttemptSelect;

type HistoryRow = Prisma.ExamAttemptGetPayload<{
  select: typeof historySelect;
}>;

@Injectable()
export class PrismaUserExamRepository implements UserExamRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async historyAccess(userId: string, viewer: AuthenticatedUser) {
    const fullAccess =
      userId === viewer.userId || viewer.platformRole === 'GLOBAL_ADMIN';
    const institutions = fullAccess
      ? []
      : await this.prisma.institutionAdmin.findMany({
          where: { userId: viewer.userId, institution: { status: 'ACTIVE' } },
          select: { institutionId: true },
        });
    const institutionIds = institutions.map((item) => item.institutionId);
    const where: Prisma.ExamAttemptWhereInput = {
      userId,
      ...(!fullAccess
        ? {
            OR: [
              { examScope: 'PUBLIC' },
              {
                examScope: 'INSTITUTIONAL',
                institutionId: { in: institutionIds },
              },
            ],
          }
        : {}),
    };
    return { fullAccess, institutionIds, where };
  }

  async findHistory(
    userId: string,
    viewer: AuthenticatedUser,
    query: ExamHistoryQuery,
  ) {
    const access = await this.historyAccess(userId, viewer);
    const where: Prisma.ExamAttemptWhereInput = {
      ...access.where,
      ...(query.examId ? { examId: query.examId } : {}),
      ...(query.scope ? { examScope: query.scope } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.examAttempt.findMany({
        where,
        select: historySelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.examAttempt.count({ where }),
    ]);
    const list = await this.historyItems(rows, access);
    return { list, total };
  }

  async findAttempt(
    userId: string,
    attemptId: string,
    viewer: AuthenticatedUser,
  ) {
    const access = await this.historyAccess(userId, viewer);
    const row = await this.prisma.examAttempt.findFirst({
      where: { ...access.where, id: attemptId },
      select: historySelect,
    });
    if (!row) return null;
    const [item] = await this.historyItems([row], access);
    return item;
  }

  private async historyItems(
    rows: HistoryRow[],
    access: { fullAccess: boolean; institutionIds: string[] },
  ): Promise<ExamAttemptHistoryItem[]> {
    const canReadAnswers = (row: HistoryRow) =>
      access.fullAccess ||
      (row.examScope === 'INSTITUTIONAL' &&
        row.institutionId !== null &&
        access.institutionIds.includes(row.institutionId));
    const detailedIds = rows.filter(canReadAnswers).map((row) => row.id);
    const answers = detailedIds.length
      ? await this.prisma.examAttemptAnswer.findMany({
          where: { attemptId: { in: detailedIds } },
          select: {
            attemptId: true,
            questionId: true,
            answerData: true,
            isCorrect: true,
            awardedMarks: true,
            answeredAt: true,
          },
          orderBy: [{ answeredAt: 'asc' }, { questionId: 'asc' }],
        })
      : [];
    return rows.map((row) => {
      const { result, ...metadata } = row;
      const item: ExamAttemptHistoryItem = {
        ...metadata,
        totalScore: result ? Number(result.score) : null,
      };
      if (canReadAnswers(row)) {
        item.result = result
          ? {
              maximumScore: Number(result.maximumScore),
              percentage: Number(result.percentage),
              passed: result.passed,
              correctAnswers: result.correctAnswers,
              incorrectAnswers: result.incorrectAnswers,
              unanswered: result.unanswered,
              gradedAt: result.gradedAt,
            }
          : null;
        item.answers = answers
          .filter((answer) => answer.attemptId === row.id)
          .map((answer) => ({
            questionId: answer.questionId,
            answerData: answer.answerData,
            isCorrect: answer.isCorrect,
            awardedMarks:
              answer.awardedMarks === null ? null : Number(answer.awardedMarks),
            answeredAt: answer.answeredAt,
          }));
      }
      return item;
    });
  }

  async findPublicExams(query: PublicExamQuery): Promise<PublicExamPage> {
    const now = new Date();
    const scheduleWhere = this.scheduleWhere(query.status, now);
    const where: Prisma.PersonalExamWhereInput = {
      deletedAt: null,
      status: {
        notIn: [PrismaExamStatus.DRAFT, PrismaExamStatus.CANCELLED],
      },
      ...scheduleWhere,
      ...(query.prefix
        ? { name: { startsWith: query.prefix, mode: 'insensitive' } }
        : {}),
    };
    const select = {
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
    } as const;

    const [list, total] = await this.prisma.$transaction([
      this.prisma.personalExam.findMany({
        where,
        select,
        orderBy: [{ [query.orderBy]: query.order }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.personalExam.count({ where }),
    ]);

    return {
      list: list.map((exam) => ({
        ...exam,
        status: this.displayStatus(exam.startsAt, exam.closesAt, now),
      })),
      total,
    };
  }

  async findAvailableById(id: string): Promise<AccessibleExam | null> {
    const now = new Date();
    const visibleStatus = {
      notIn: [PrismaExamStatus.DRAFT, PrismaExamStatus.CANCELLED],
    };
    const [publicExam, institutionalExam] = await Promise.all([
      this.prisma.personalExam.findFirst({
        where: { id, deletedAt: null, status: visibleStatus },
        select: {
          id: true,
          status: true,
          accessMode: true,
          startsAt: true,
          closesAt: true,
        },
      }),
      this.prisma.institutionExam.findFirst({
        where: {
          id,
          deletedAt: null,
          status: visibleStatus,
          institution: { status: 'ACTIVE' },
        },
        select: {
          id: true,
          status: true,
          accessMode: true,
          startsAt: true,
          closesAt: true,
        },
      }),
    ]);

    if (publicExam) {
      const { startsAt, closesAt, ...result } = publicExam;
      return {
        ...result,
        status: this.displayStatus(startsAt, closesAt, now),
        scope: 'PUBLIC',
      };
    }
    if (institutionalExam) {
      const { startsAt, closesAt, ...result } = institutionalExam;
      return {
        ...result,
        status: this.displayStatus(startsAt, closesAt, now),
        scope: 'INSTITUTIONAL',
      };
    }
    return null;
  }

  async hasActiveEnrollment(
    institutionId: string,
    userId: string,
  ): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        institutionId_userId: { institutionId, userId },
      },
      select: { status: true, expiresAt: true },
    });

    return (
      enrollment?.status === 'ACTIVE' &&
      (enrollment.expiresAt === null || enrollment.expiresAt > new Date())
    );
  }

  async findInstitutionExams(
    institutionId: string,
    query: InstitutionExamQuery,
  ): Promise<InstitutionExamPage> {
    const now = new Date();
    const where: Prisma.InstitutionExamWhereInput = {
      institutionId,
      ...(query.id ? { id: query.id } : {}),
      deletedAt: null,
      status: {
        notIn: [PrismaExamStatus.DRAFT, PrismaExamStatus.CANCELLED],
      },
      startsAt: { not: null },
      closesAt: { gt: now },
      institution: {
        status: 'ACTIVE',
      },
    };
    const [exams, total] = await this.prisma.$transaction([
      this.prisma.institutionExam.findMany({
        where,
        select: {
          id: true,
          status: true,
          accessMode: true,
          startsAt: true,
          closesAt: true,
          durationMinutes: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.institutionExam.count({ where }),
    ]);

    return {
      list: exams.map(({ startsAt, closesAt, ...exam }) => ({
        ...exam,
        startsAt,
        closesAt,
        status: this.displayStatus(startsAt, closesAt, now),
        scope: 'INSTITUTIONAL',
      })),
      total,
    };
  }

  private scheduleWhere(
    status: PublicExamStatus | undefined,
    now: Date,
  ): Prisma.PersonalExamWhereInput {
    if (status === 'SCHEDULED') {
      return { startsAt: { gt: now }, closesAt: { gt: now } };
    }
    if (status === 'RUNNING') {
      return { startsAt: { lte: now }, closesAt: { gt: now } };
    }
    if (status === 'COMPLETED') return { closesAt: { lte: now } };
    return {
      OR: [
        { startsAt: { gt: now }, closesAt: { gt: now } },
        { startsAt: { lte: now }, closesAt: { gt: now } },
        { closesAt: { lte: now } },
      ],
    };
  }

  private displayStatus(
    startsAt: Date | null,
    closesAt: Date | null,
    now: Date,
  ): PublicExamStatus {
    if (closesAt && closesAt <= now) return 'COMPLETED';
    if (startsAt && startsAt <= now) return 'RUNNING';
    return 'SCHEDULED';
  }
}
