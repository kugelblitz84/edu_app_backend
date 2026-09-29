import { Injectable, Logger } from '@nestjs/common';
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
import { MINIMUM_EXAM_WINDOW_MS } from '../presentation/exam.dto';

@Injectable()
export class PrismaMongoExamRepository implements ExamRepository {
  private readonly logger = new Logger(PrismaMongoExamRepository.name);

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
          accessMode: input.accessMode,
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
        accessMode: input.accessMode,
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

  async scheduleDraft(
    id: string,
    scope: ExamScope,
    userId: string,
    input: ScheduleExamInput & { contentVersion: number },
  ): Promise<Exam | null> {
    if (
      input.closesAt.getTime() - input.startsAt.getTime() <
        MINIMUM_EXAM_WINDOW_MS ||
      input.closesAt.getTime() - Date.now() < MINIMUM_EXAM_WINDOW_MS
    ) {
      return null;
    }
    const data = {
      startsAt: input.startsAt,
      closesAt: input.closesAt,
      durationMinutes: input.durationMinutes,
      maxAttempts: input.maxAttempts,
      passPercentage: input.passPercentage,
      contentVersion: input.contentVersion,
      status: 'SCHEDULED' as const,
    };
    const publicationId = randomUUID();
    const scheduled = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'exam:' + id})) IS NULL AS locked`;
      const where = {
        ...this.editableWhere(id, scope, userId),
        status: PrismaExamStatus.DRAFT,
        contentVersion: input.contentVersion - 1,
      };
      const current =
        scope === 'PUBLIC'
          ? await tx.personalExam.findFirst({ where })
          : await tx.institutionExam.findFirst({ where });
      if (!current) return null;

      await this.examDataModel
        .deleteOne({ examId: id, version: input.contentVersion })
        .exec();
      await this.createPendingContent(
        id,
        input.contentVersion,
        publicationId,
        input.questions,
      );

      const result =
        scope === 'PUBLIC'
          ? await tx.personalExam.updateMany({ where, data })
          : await tx.institutionExam.updateMany({ where, data });
      if (result.count !== 1) {
        await this.discardPendingContent(
          id,
          input.contentVersion,
          publicationId,
        );
        return null;
      }
      if (scope === 'PUBLIC') {
        const exam = await tx.personalExam.findUnique({ where: { id } });
        return exam ? this.toPublicExam(exam) : null;
      }
      const exam = await tx.institutionExam.findUnique({ where: { id } });
      return exam ? this.toInstitutionalExam(exam) : null;
    });
    if (scheduled) {
      await this.publishContent(id, input.contentVersion, publicationId);
    }
    return scheduled;
  }

  async updateMetadata(
    id: string,
    scope: ExamScope,
    userId: string,
    input: UpdateExamMetadataInput,
  ): Promise<Exam | null> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'exam:' + id})) IS NULL AS locked`;
      const now = new Date();
      const editableWhere = {
        ...this.editableWhere(id, scope, userId),
        status: { in: [PrismaExamStatus.DRAFT, PrismaExamStatus.SCHEDULED] },
        OR: [{ startsAt: null }, { startsAt: { gt: now } }],
      };
      const current =
        scope === 'PUBLIC'
          ? await tx.personalExam.findFirst({ where: editableWhere })
          : await tx.institutionExam.findFirst({ where: editableWhere });
      if (!current || !this.isValidMetadataResult(current, input, now)) {
        return null;
      }
      const attempts = await tx.examAttempt.count({
        where: { examId: id, examScope: scope },
      });
      if (attempts > 0) return null;

      const where = {
        ...editableWhere,
        contentVersion: current.contentVersion,
      };
      if (scope === 'PUBLIC') {
        const result = await tx.personalExam.updateMany({ where, data: input });
        if (result.count === 0) return null;
        const exam = await tx.personalExam.findUnique({ where: { id } });
        return exam ? this.toPublicExam(exam) : null;
      }

      const result = await tx.institutionExam.updateMany({
        where,
        data: input,
      });
      if (result.count === 0) return null;
      const exam = await tx.institutionExam.findUnique({ where: { id } });
      return exam ? this.toInstitutionalExam(exam) : null;
    });
  }

  async updateContent(
    examId: string,
    input: UpdateExamContentInput,
  ): Promise<ExamData | null> {
    const questions = input.questions;
    if (!questions) return null;
    const publicationId = randomUUID();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${
        'exam:' + examId
      })) IS NULL AS locked`;
      const timeWhere = {
        id: examId,
        deletedAt: null,
        status: { in: [PrismaExamStatus.DRAFT, PrismaExamStatus.SCHEDULED] },
        OR: [{ startsAt: null }, { startsAt: { gt: new Date() } }],
      };
      const [personal, institutional] = await Promise.all([
        tx.personalExam.findFirst({ where: timeWhere }),
        tx.institutionExam.findFirst({ where: timeWhere }),
      ]);
      const exam = personal ?? institutional;
      if (!exam) return null;
      const scope = personal ? 'PUBLIC' : 'INSTITUTIONAL';
      const attemptCount = await tx.examAttempt.count({
        where: { examId, examScope: scope },
      });
      if (attemptCount > 0) return null;

      const version = exam.contentVersion + 1;
      await this.examDataModel.deleteOne({ examId, version }).exec();
      const created = await this.createPendingContent(
        examId,
        version,
        publicationId,
        questions,
      );
      const versionWhere = {
        ...timeWhere,
        contentVersion: exam.contentVersion,
      };
      const result = personal
        ? await tx.personalExam.updateMany({
            where: versionWhere,
            data: { contentVersion: version },
          })
        : await tx.institutionExam.updateMany({
            where: versionWhere,
            data: { contentVersion: version },
          });
      if (result.count !== 1) {
        await this.discardPendingContent(examId, version, publicationId);
        return null;
      }
      return created;
    });
    if (!updated) return null;
    await this.publishContent(examId, updated.version, publicationId);
    return updated;
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

  private async createPendingContent(
    examId: string,
    version: number,
    publicationId: string,
    questions: ScheduleExamInput['questions'],
  ): Promise<ExamData> {
    const created = await this.examDataModel.create({
      examId,
      version,
      publicationId,
      publicationState: 'PENDING',
      totalQuestions: questions.length,
      questions: this.withStableIds(questions),
    });
    return created.toObject<ExamData>();
  }

  private async discardPendingContent(
    examId: string,
    version: number,
    publicationId: string,
  ): Promise<void> {
    await this.examDataModel
      .deleteOne({
        examId,
        version,
        publicationId,
        publicationState: 'PENDING',
      })
      .exec();
  }

  private async publishContent(
    examId: string,
    version: number,
    publicationId: string,
  ): Promise<void> {
    try {
      const result = await this.examDataModel
        .updateOne(
          { examId, version, publicationId, publicationState: 'PENDING' },
          { $set: { publicationState: 'PUBLISHED' } },
        )
        .exec();
      if (result.matchedCount !== 1) {
        this.logger.warn(
          `Content publication ${publicationId} was not found for ${examId} v${version}.`,
        );
      }
    } catch (error) {
      // PostgreSQL already points at this token-owned version. Keeping it
      // PENDING makes the operation recoverable and the content readable.
      this.logger.error(
        `Failed to mark content ${examId} v${version} as published.`,
        error,
      );
    }
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
      status: this.displayExamStatus(exam.status, exam.startsAt, exam.closesAt),
      passPercentage:
        exam.passPercentage === null ? null : Number(exam.passPercentage),
      scope: 'PUBLIC',
      institutionId: null,
    };
  }

  private toInstitutionalExam(exam: PrismaInstitutionExam): InstitutionalExam {
    return {
      ...exam,
      status: this.displayExamStatus(exam.status, exam.startsAt, exam.closesAt),
      passPercentage:
        exam.passPercentage === null ? null : Number(exam.passPercentage),
      scope: 'INSTITUTIONAL',
    };
  }

  private displayExamStatus(
    stored: Exam['status'],
    startsAt: Date | null,
    closesAt: Date | null,
  ): Exam['status'] {
    if (stored === 'DRAFT' || stored === 'CANCELLED') return stored;
    const now = new Date();
    if (closesAt && closesAt <= now) return 'COMPLETED';
    if (startsAt && startsAt <= now) return 'RUNNING';
    return 'SCHEDULED';
  }

  private isValidMetadataResult(
    current: PrismaPersonalExam | PrismaInstitutionExam,
    input: UpdateExamMetadataInput,
    now: Date,
  ): boolean {
    if (current.status === PrismaExamStatus.DRAFT) return true;

    const startsAt =
      input.startsAt === undefined ? current.startsAt : input.startsAt;
    const closesAt =
      input.closesAt === undefined ? current.closesAt : input.closesAt;
    const durationMinutes =
      input.durationMinutes === undefined
        ? current.durationMinutes
        : input.durationMinutes;

    return Boolean(
      startsAt &&
      closesAt &&
      durationMinutes &&
      startsAt > now &&
      closesAt.getTime() - startsAt.getTime() >= MINIMUM_EXAM_WINDOW_MS &&
      closesAt.getTime() - now.getTime() >= MINIMUM_EXAM_WINDOW_MS,
    );
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
