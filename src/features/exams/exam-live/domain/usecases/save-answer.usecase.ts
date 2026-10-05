import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExamContentReader } from '../contracts/exam-content.reader';
import { LiveExamRepository } from '../contracts/live-exam.repository';

@Injectable()
export class SaveAnswerUseCase {
  constructor(
    private readonly repository: LiveExamRepository,
    private readonly content: ExamContentReader,
  ) {}

  async execute(input: {
    attemptId: string;
    userId: string;
    questionId: string;
    selectedOptionIds: string[];
    revision: number;
  }) {
    const attempt = await this.repository.findOwned(
      input.attemptId,
      input.userId,
    );
    if (!attempt) throw new NotFoundException('Attempt not found.');
    if (
      !(await this.content.hasQuestion(
        attempt.examId,
        attempt.contentVersion,
        input.questionId,
      ))
    ) {
      throw new ForbiddenException('Question does not belong to this attempt.');
    }
    const result = await this.repository.saveAnswer({
      ...input,
      now: new Date(),
    });
    if (!result)
      throw new ConflictException('The attempt is no longer active.');
    return { questionId: input.questionId, ...result };
  }
}
