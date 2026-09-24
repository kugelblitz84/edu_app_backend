import { Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import {
  examDataSchema,
  type ExamData,
} from '../../../../mongoose/models/exam-data.model';
import { MongooseService } from '../../../core/database/mongoose.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { ExamRepository } from '../domain/exam.repository';
import type {
  CreateDraftExamInput,
  InstitutionExam,
  ScheduleExamInput,
  UpdateExamContentInput,
  UpdateExamMetadataInput,
} from '../domain/exam.types';

@Injectable()
export class PrismaMongoExamRepository implements ExamRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongoose: MongooseService,
  ) {}

  async createDraft(
    input: CreateDraftExamInput,
  ): Promise<InstitutionExam | null> {
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

    return this.prisma.institutionExam.create({
      data: {
        institutionId: input.institutionId,
        name: input.name,
        description: input.description,
        createdByUserId: input.createdByUserId,
        status: 'DRAFT',
      },
    });
  }

  findAccessibleById(
    id: string,
    userId: string,
  ): Promise<InstitutionExam | null> {
    return this.prisma.institutionExam.findFirst({
      where: {
        id,
        deletedAt: null,
        institution: {
          status: 'ACTIVE',
          admins: { some: { userId } },
        },
      },
    });
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
    input: Pick<ScheduleExamInput, 'examDate' | 'durationMinutes'>,
  ): Promise<InstitutionExam | null> {
    const result = await this.prisma.institutionExam.updateMany({
      where: { id, status: 'DRAFT', deletedAt: null },
      data: {
        examDate: input.examDate,
        durationMinutes: input.durationMinutes,
        status: 'SCHEDULED',
      },
    });
    if (result.count === 0) return null;
    return this.prisma.institutionExam.findUnique({ where: { id } });
  }

  async updateMetadata(
    id: string,
    input: UpdateExamMetadataInput,
  ): Promise<InstitutionExam | null> {
    const result = await this.prisma.institutionExam.updateMany({
      where: {
        id,
        status: { in: ['DRAFT', 'SCHEDULED'] },
        deletedAt: null,
      },
      data: input,
    });
    if (result.count === 0) return null;
    return this.prisma.institutionExam.findUnique({ where: { id } });
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

  private get examDataModel(): Model<ExamData> {
    return (
      (this.mongoose.connection.models.ExamData as
        Model<ExamData> | undefined) ??
      this.mongoose.connection.model<ExamData>('ExamData', examDataSchema)
    );
  }
}
