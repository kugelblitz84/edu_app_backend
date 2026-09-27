import { Injectable } from '@nestjs/common';
import { ExamStatus as PrismaExamStatus } from '@prisma/client';
import type { Model } from 'mongoose';
import {
  examDataSchema,
  type ExamData,
} from '../../../../../mongoose/models/exam-data.model';
import { MongooseService } from '../../../../core/database/mongoose.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { ExamRepository } from '../domain/exam.repository';
import type {
  CreateDraftExamInput,
  Exam,
  ExamScope,
  InstitutionalExam,
  PublicExam,
  ScheduleExamInput,
  UpdateExamContentInput,
  UpdateExamMetadataInput,
  ActiveCandidate,
} from '../domain/exam.types';

@Injectable()
export class PrismaMongoExamRepository implements ExamRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongoose: MongooseService,
  ) {}

  async createDraft(input: CreateDraftExamInput): Promise<Exam | null> {
    if (input.scope === 'PUBLIC') {
      const exam = await this.prisma.personalExam.create({
        data: {
          name: input.name,
          description: input.description,
          createdByUserId: input.createdByUserId,
          status: 'DRAFT',
        },
      });
      return this.toPublicExam(exam);
    }

    const membership = await this.prisma.institutionAdmin.findUnique({
      where: {
        institutionId_userId: {
          institutionId: input.institutionId,
          userId: input.createdByUserId,
        },
      },
      select: { institution: { select: { status: true } } },
    });
    if (!membership || membership.institution.status !== 'ACTIVE') return null;

    const exam = await this.prisma.institutionExam.create({
      data: {
        institutionId: input.institutionId,
        name: input.name,
        description: input.description,
        createdByUserId: input.createdByUserId,
        status: 'DRAFT',
      },
    });
    return this.toInstitutionalExam(exam);
  }

  async findAccessibleById(id: string, userId: string): Promise<Exam | null> {
    const [publicExam, institutionalExam] = await Promise.all([
      this.prisma.personalExam.findFirst({
        where: { id, createdByUserId: userId, deletedAt: null },
      }),
      this.prisma.institutionExam.findFirst({
        where: {
          id,
          deletedAt: null,
          institution: {
            status: 'ACTIVE',
            admins: { some: { userId } },
          },
        },
      }),
    ]);

    if (publicExam) return this.toPublicExam(publicExam);
    if (institutionalExam) return this.toInstitutionalExam(institutionalExam);
    return null;
  }

  async upsertExamData(
    examId: string,
    questions: ScheduleExamInput['questions'],
  ): Promise<void> {
    await this.examDataModel
      .replaceOne(
        { examId },
        { examId, totalQuestions: questions.length, questions },
        { upsert: true, runValidators: true },
      )
      .exec();
  }

  async scheduleDraft(
    id: string,
    scope: ExamScope,
    userId: string,
    input: Pick<ScheduleExamInput, 'examDate' | 'durationMinutes'>,
  ): Promise<Exam | null> {
    const where = this.editableWhere(id, scope, userId);
    const data = {
      examDate: input.examDate,
      durationMinutes: input.durationMinutes,
      status: 'SCHEDULED' as const,
    };

    if (scope === 'PUBLIC') {
      const result = await this.prisma.personalExam.updateMany({
        where: { ...where, status: 'DRAFT' },
        data,
      });
      if (result.count === 0) return null;
      const exam = await this.prisma.personalExam.findUnique({ where: { id } });
      return exam ? this.toPublicExam(exam) : null;
    }

    const result = await this.prisma.institutionExam.updateMany({
      where: { ...where, status: 'DRAFT' },
      data: {
        ...data,
      },
    });
    if (result.count === 0) return null;
    const exam = await this.prisma.institutionExam.findUnique({
      where: { id },
    });
    return exam ? this.toInstitutionalExam(exam) : null;
  }

  async updateMetadata(
    id: string,
    scope: ExamScope,
    userId: string,
    input: UpdateExamMetadataInput,
  ): Promise<Exam | null> {
    const where = {
      ...this.editableWhere(id, scope, userId),
      status: { in: [PrismaExamStatus.DRAFT, PrismaExamStatus.SCHEDULED] },
    };

    if (scope === 'PUBLIC') {
      const result = await this.prisma.personalExam.updateMany({
        where,
        data: input,
      });
      if (result.count === 0) return null;
      const exam = await this.prisma.personalExam.findUnique({ where: { id } });
      return exam ? this.toPublicExam(exam) : null;
    }

    const result = await this.prisma.institutionExam.updateMany({
      where,
      data: input,
    });
    if (result.count === 0) return null;
    const exam = await this.prisma.institutionExam.findUnique({
      where: { id },
    });
    return exam ? this.toInstitutionalExam(exam) : null;
  }

  async updateContent(
    examId: string,
    input: UpdateExamContentInput,
  ): Promise<ExamData | null> {
    const questions = input.questions;
    if (!questions) return null;

    return this.examDataModel
      .findOneAndUpdate(
        { examId },
        {
          $set: {
            questions,
            totalQuestions: questions.length,
          },
        },
        { new: true, runValidators: true },
      )
      .lean<ExamData>()
      .exec();
  }

  findActiveCandidatesByEmails(emails: string[]): Promise<ActiveCandidate[]> {
    return this.prisma.user.findMany({
      where: {
        email: { in: emails },
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true, email: true },
    });
  }

  private get examDataModel(): Model<ExamData> {
    return (
      (this.mongoose.connection.models.ExamData as
        Model<ExamData> | undefined) ??
      this.mongoose.connection.model<ExamData>('ExamData', examDataSchema)
    );
  }

  private editableWhere(id: string, scope: ExamScope, userId: string) {
    if (scope === 'PUBLIC') {
      return { id, createdByUserId: userId, deletedAt: null };
    }

    return {
      id,
      deletedAt: null,
      institution: {
        status: 'ACTIVE' as const,
        admins: { some: { userId } },
      },
    };
  }

  private toPublicExam(
    exam: Omit<PublicExam, 'scope' | 'institutionId'>,
  ): PublicExam {
    return { ...exam, scope: 'PUBLIC', institutionId: null };
  }

  private toInstitutionalExam(
    exam: Omit<InstitutionalExam, 'scope'>,
  ): InstitutionalExam {
    return { ...exam, scope: 'INSTITUTIONAL' };
  }
}
