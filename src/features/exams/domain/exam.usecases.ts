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
import type { InstitutionExam, UpdateExamMetadataInput } from './exam.types';
import type { ExamData } from '../../../../mongoose/models/exam-data.model';

@Injectable()
export class ExamUseCases {
  constructor(private readonly repository: ExamRepository) {}

  async createDraft(
    userId: string,
    input: CreateExamRequestDto,
  ): Promise<InstitutionExam> {
    const exam = await this.repository.createDraft({
      ...input,
      createdByUserId: userId,
    });
    if (!exam) {
      throw new ForbiddenException(
        'You are not an administrator of this active institution.',
      );
    }
    return exam;
  }

  async schedule(
    id: string,
    userId: string,
    input: ScheduleExamRequestDto,
  ): Promise<InstitutionExam> {
    const exam = await this.repository.findAccessibleById(id, userId);
    if (!exam) throw new NotFoundException('Exam not found.');
    if (exam.status !== 'DRAFT') {
      throw new ConflictException('Only a draft exam can be scheduled.');
    }

    // Mongo is deliberately written first. Its unique examId upsert makes a
    // retry safe when the following PostgreSQL operation fails.
    await this.repository.upsertExamData(id, input.questions);

    const scheduled = await this.repository.scheduleDraft(id, {
      examDate: new Date(input.examDate),
      durationMinutes: input.durationMinutes,
    });
    if (!scheduled) {
      throw new ConflictException('Only a draft exam can be scheduled.');
    }
    return scheduled;
  }

  async updateMetadata(
    id: string,
    userId: string,
    input: UpdateExamMetadataRequestDto,
  ): Promise<InstitutionExam> {
    await this.requireEditableExam(id, userId);

    const { examDate, ...otherMetadata } = input;
    const metadata: UpdateExamMetadataInput = otherMetadata;
    if (examDate !== undefined) {
      metadata.examDate = examDate === null ? null : new Date(examDate);
    }

    const updated = await this.repository.updateMetadata(id, metadata);
    if (!updated) throw new NotFoundException('Exam not found.');
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

  private async requireEditableExam(
    id: string,
    userId: string,
  ): Promise<void> {
    const exam = await this.repository.findAccessibleById(id, userId);
    if (!exam) throw new NotFoundException('Exam not found.');
    if (exam.status !== 'DRAFT' && exam.status !== 'SCHEDULED') {
      throw new ConflictException(
        'Only draft or scheduled exams can be updated.',
      );
    }
    // return exam;
  }
}
