import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateExamRequestDto,
  ScheduleExamRequestDto,
} from '../presentation/exam.dto';
import { ExamRepository } from './exam.repository';
import type { InstitutionExam } from './exam.types';

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
}
