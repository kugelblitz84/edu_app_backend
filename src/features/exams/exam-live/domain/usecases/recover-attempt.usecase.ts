import { Injectable, NotFoundException } from '@nestjs/common';
import { ExamContentReader } from '../contracts/exam-content.reader';
import { LiveExamRepository } from '../contracts/live-exam.repository';

@Injectable()
export class RecoverAttemptUseCase {
  constructor(
    private readonly repository: LiveExamRepository,
    private readonly content: ExamContentReader,
  ) {}

  async execute(attemptId: string, userId: string) {
    const attempt = await this.repository.findOwned(attemptId, userId);
    if (!attempt) throw new NotFoundException('Attempt not found.');
    const questions = await this.content.getCandidateQuestions(
      attempt.examId,
      attempt.contentVersion,
    );
    if (!questions) throw new NotFoundException('Exam content not found.');
    return {
      attemptId: attempt.id,
      status: attempt.status,
      serverTime: new Date(),
      expiresAt: attempt.expiresAt,
      questions,
      savedAnswers: attempt.answers,
    };
  }
}
