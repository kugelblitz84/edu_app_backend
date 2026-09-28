import { Injectable } from '@nestjs/common';
import { ExamStatus as PrismaExamStatus } from '@prisma/client';
import type {
  InstitutionExam as PrismaInstitutionExam,
  PersonalExam as PrismaPersonalExam,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
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

  async createExamDataVersion(
    examId: string,
    version: number,
    questions: ScheduleExamInput['questions'],
  ): Promise<void> {
    await this.examDataModel
      .updateOne(
        { examId, version },
        {
          $setOnInsert: {
            examId,
            version,
            totalQuestions: questions.length,
            questions: this.withStableIds(questions),
          },
        },
        { upsert: true, runValidators: true },
      )
      .exec();
  }

  async scheduleDraft(
    id: string,
    scope: ExamScope,
    userId: string,
    input: Omit<ScheduleExamInput, 'questions'> & { contentVersion: number },
  ): Promise<Exam | null> {
    const where = this.editableWhere(id, scope, userId);
    const data = {
      startsAt: input.startsAt,
      closesAt: input.closesAt,
      durationMinutes: input.durationMinutes,
      maxAttempts: input.maxAttempts,
      passPercentage: input.passPercentage,
      contentVersion: input.contentVersion,
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
    const timeWhere = {
      id: examId,
      deletedAt: null,
      status: { in: [PrismaExamStatus.DRAFT, PrismaExamStatus.SCHEDULED] },
      OR: [{ startsAt: null }, { startsAt: { gt: new Date() } }],
    };
    const attemptCount = await this.prisma.examAttempt.count({
      where: { examId },
    });
    if (attemptCount > 0) return null;
    const [personal, institutional] = await Promise.all([
      this.prisma.personalExam.findFirst({ where: timeWhere }),
      this.prisma.institutionExam.findFirst({ where: timeWhere }),
    ]);
    const exam = personal ?? institutional;
    if (!exam) return null;

    const version = exam.contentVersion + 1;
    const data = {
      examId,
      version,
      totalQuestions: questions.length,
      questions: this.withStableIds(questions),
    };
    const created = await this.examDataModel.create(data);
    const versionWhere = { ...timeWhere, contentVersion: exam.contentVersion };
    const updated = personal
      ? await this.prisma.personalExam.updateMany({
          where: versionWhere,
          data: { contentVersion: version },
        })
      : await this.prisma.institutionExam.updateMany({
          where: versionWhere,
          data: { contentVersion: version },
        });
    if (updated.count !== 1) return null;
    return created.toObject<ExamData>();
  }

  findActiveCandidatesByIds(userIds: string[]): Promise<ActiveCandidate[]> {
    return this.prisma.user.findMany({
      where: {
        id: { in: userIds },
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

  private toPublicExam(exam: PrismaPersonalExam): PublicExam {
    return {
      ...exam,
      passPercentage:
        exam.passPercentage === null ? null : Number(exam.passPercentage),
      scope: 'PUBLIC',
      institutionId: null,
    };
  }

  private toInstitutionalExam(exam: PrismaInstitutionExam): InstitutionalExam {
    return {
      ...exam,
      passPercentage:
        exam.passPercentage === null ? null : Number(exam.passPercentage),
      scope: 'INSTITUTIONAL',
    };
  }

  private withStableIds(questions: ScheduleExamInput['questions']) {
    return questions.map((question) => {
      const options = question.options.map((text) => ({
        optionId: randomUUID(),
        text,
      }));
      const correct = options.find(
        (option) => option.text === question.correctAnswer,
      );
      return {
        questionId: randomUUID(),
        question: question.question,
        options,
        correctOptionIds: correct ? [correct.optionId] : [],
        markValue: question.markValue,
      };
    });
  }
}
