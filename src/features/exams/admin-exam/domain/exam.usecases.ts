import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateExamRequestDto,
  ScheduleExamRequestDto,
  UpdateExamContentRequestDto,
  UpdateExamMetadataRequestDto,
} from '../presentation/exam.dto';
import { ExamRepository } from './exam.repository';
import type { Exam, UpdateExamMetadataInput } from './exam.types';
import type { ExamData } from '../../../../../mongoose/models/exam-data.model';

@Injectable()
export class ExamUseCases {
  constructor(private readonly repository: ExamRepository) {}

  async createDraft(
    userId: string,
    input: CreateExamRequestDto,
  ): Promise<Exam> {
    const exam = await this.repository.createDraft({
      ...input,
      createdByUserId: userId,
    });
    if (!exam) {
      throw new ForbiddenException('You cannot create this exam.');
    }
    return exam;
  }

  async schedule(
    id: string,
    userId: string,
    input: ScheduleExamRequestDto,
  ): Promise<Exam> {
    const exam = await this.repository.findAccessibleById(id, userId);
    if (!exam) throw new NotFoundException('Exam not found.');
    if (exam.status !== 'DRAFT') {
      throw new ConflictException('Only a draft exam can be scheduled.');
    }

    const contentVersion = exam.contentVersion + 1;
    const scheduled = await this.repository.scheduleDraft(
      id,
      exam.scope,
      userId,
      {
        startsAt: new Date(input.startsAt),
        closesAt: new Date(input.closesAt),
        durationMinutes: input.durationMinutes,
        maxAttempts: input.maxAttempts,
        passPercentage: input.passPercentage,
        questions: input.questions,
        contentVersion,
      },
    );
    if (!scheduled) {
      throw new ConflictException('Only a draft exam can be scheduled.');
    }
    return scheduled;
  }

  async updateMetadata(
    id: string,
    userId: string,
    input: UpdateExamMetadataRequestDto,
  ): Promise<Exam> {
    const exam = await this.requireEditableExam(id, userId);

    const { startsAt, closesAt, ...otherMetadata } = input;
    const metadata: UpdateExamMetadataInput = otherMetadata;
    if (startsAt !== undefined)
      metadata.startsAt = startsAt === null ? null : new Date(startsAt);
    if (closesAt !== undefined)
      metadata.closesAt = closesAt === null ? null : new Date(closesAt);

    const updated = await this.repository.updateMetadata(
      id,
      exam.scope,
      userId,
      metadata,
    );
    if (!updated) {
      throw new ConflictException(
        'The exam can no longer be edited because it started or has attempts.',
      );
    }
    return updated;
  }

  async updateContent(
    id: string,
    userId: string,
    input: UpdateExamContentRequestDto,
  ): Promise<ExamData> {
    await this.requireEditableExam(id, userId);

    const updated = await this.repository.updateContent(id, input);
    if (!updated) throw new NotFoundException('Exam content not found.');
    return updated;
  }

  private async requireEditableExam(id: string, userId: string): Promise<Exam> {
    const exam = await this.repository.findAccessibleById(id, userId);
    if (!exam) throw new NotFoundException('Exam not found.');
    if (exam.status !== 'DRAFT' && exam.status !== 'SCHEDULED') {
      throw new ConflictException(
        'Only draft or scheduled exams can be updated.',
      );
    }
    if (exam.startsAt && exam.startsAt <= new Date()) {
      throw new ConflictException('An exam cannot be edited after it starts.');
    }
    return exam;
  }
}
