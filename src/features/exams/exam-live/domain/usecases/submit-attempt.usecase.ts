import { Injectable, NotFoundException } from '@nestjs/common';
import { LiveExamRepository } from '../contracts/live-exam.repository';
import { LiveExamRealtimePublisher } from '../contracts/live-exam-realtime.publisher';
import { GradeAttemptUseCase } from './grade-attempt.usecase';

@Injectable()
export class SubmitAttemptUseCase {
  constructor(
    private readonly repository: LiveExamRepository,
    private readonly grader: GradeAttemptUseCase,
    private readonly realtime: LiveExamRealtimePublisher,
  ) {}

  async execute(attemptId: string, userId: string) {
    const attempt = await this.repository.finalize(
      attemptId,
      userId,
      new Date(),
    );
    if (!attempt) throw new NotFoundException('Attempt not found.');
    this.realtime.attemptSubmitted(userId, attemptId);
    const result = await this.grader.execute(attemptId);
    if (result) this.realtime.attemptGraded(userId, attemptId);
    return { attemptId, status: result?.status ?? attempt.status, result };
  }
}
