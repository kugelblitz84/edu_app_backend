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
    const publicStatuses = [
      PrismaExamStatus.SCHEDULED,
      PrismaExamStatus.RUNNING,
      PrismaExamStatus.COMPLETED,
    ];
    const where: Prisma.PersonalExamWhereInput = {
      deletedAt: null,
      status: query.status ? query.status : { in: publicStatuses },
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
        status: exam.status as PublicExamStatus,
      })),
      total,
    };
  }

  async findAvailableById(id: string): Promise<AccessibleExam | null> {
    const statuses = [PrismaExamStatus.SCHEDULED, PrismaExamStatus.RUNNING];
    const [publicExam, institutionalExam] = await Promise.all([
      this.prisma.personalExam.findFirst({
        where: { id, deletedAt: null, status: { in: statuses } },
        select: { id: true, status: true, accessMode: true },
      }),
      this.prisma.institutionExam.findFirst({
        where: {
          id,
          deletedAt: null,
          status: { in: statuses },
          institution: { status: 'ACTIVE' },
        },
        select: { id: true, status: true, accessMode: true },
      }),
    ]);

    if (publicExam) return { ...publicExam, scope: 'PUBLIC' };
    if (institutionalExam) {
      return { ...institutionalExam, scope: 'INSTITUTIONAL' };
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
    const where: Prisma.InstitutionExamWhereInput = {
      institutionId,
      ...(query.id ? { id: query.id } : {}),
      deletedAt: null,
      status: {
        in: [PrismaExamStatus.SCHEDULED, PrismaExamStatus.RUNNING],
      },
      institution: {
        status: 'ACTIVE',
      },
    };
    const [exams, total] = await this.prisma.$transaction([
      this.prisma.institutionExam.findMany({
        where,
        select: { id: true, status: true, accessMode: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.institutionExam.count({ where }),
    ]);

    return {
      list: exams.map((exam) => ({ ...exam, scope: 'INSTITUTIONAL' })),
      total,
    };
  }
}
