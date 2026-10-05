import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import {
  ExamAccessRepository,
  type AccessibleExam,
} from '../domain/exam-access.repository';

@Injectable()
export class PrismaExamAccessRepository implements ExamAccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findExamForAccess(id: string): Promise<AccessibleExam | null> {
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
    const [personal, institutional] = await Promise.all([
      this.prisma.personalExam.findFirst({
        where: { id, deletedAt: null },
        select,
      }),
      this.prisma.institutionExam.findFirst({
        where: { id, deletedAt: null, institution: { status: 'ACTIVE' } },
        select: { ...select, institutionId: true },
      }),
    ]);
    const exam = personal ?? institutional;
    if (!exam) return null;
    return {
      ...exam,
      scope: personal ? 'PUBLIC' : 'INSTITUTIONAL',
      institutionId: institutional?.institutionId ?? null,
      passPercentage:
        exam.passPercentage === null ? null : Number(exam.passPercentage),
    };
  }

  async hasActiveEnrollment(
    institutionId: string,
    userId: string,
  ): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { institutionId_userId: { institutionId, userId } },
      select: { status: true, expiresAt: true },
    });
    return (
      enrollment?.status === 'ACTIVE' &&
      (enrollment.expiresAt === null || enrollment.expiresAt > new Date())
    );
  }
}
