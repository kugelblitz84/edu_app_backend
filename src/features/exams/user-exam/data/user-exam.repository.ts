import { Injectable } from '@nestjs/common';
import { ExamStatus as PrismaExamStatus } from '@prisma/client';
import { PrismaService } from '../../../../core/database/prisma.service';
import {
  UserExamRepository,
  type AccessibleExam,
} from '../domain/user-exam.contracts';

@Injectable()
export class PrismaUserExamRepository implements UserExamRepository {
  constructor(private readonly prisma: PrismaService) {}

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
}
