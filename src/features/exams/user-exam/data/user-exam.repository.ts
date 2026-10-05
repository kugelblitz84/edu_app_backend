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

@Injectable()
export class PrismaUserExamRepository implements UserExamRepository {
  constructor(private readonly prisma: PrismaService) {}

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
