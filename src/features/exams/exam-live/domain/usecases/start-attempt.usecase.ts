import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ExamAccessService } from '../../../shared/domain/exam-access.service';
import { ExamContentReader } from '../contracts/exam-content.reader';
import {
  LiveExamRepository,
  type AttemptMetadata,
} from '../contracts/live-exam.repository';

@Injectable()
export class StartAttemptUseCase {
  constructor(
    private readonly access: ExamAccessService,
    private readonly repository: LiveExamRepository,
    private readonly content: ExamContentReader,
  ) {}

  async execute(
    examId: string,
    userId: string,
    invitationToken: string | undefined,
    metadata: AttemptMetadata,
  ) {
    const now = new Date();
    const exam = await this.access.authorize(
      examId,
      userId,
      invitationToken,
      now,
    );
    const attempt = await this.repository.startOrResume(exam, userId, metadata);
    if (!attempt) {
      throw new ConflictException(
        'The maximum number of attempts was reached.',
      );
    }
    const questions = await this.content.getCandidateQuestions(
      attempt.examId,
      attempt.contentVersion,
    );
    if (!questions) {
      throw new ServiceUnavailableException('Exam content is unavailable.');
    }
    return { attempt, questions, serverTime: attempt.startedAt };
  }
}
