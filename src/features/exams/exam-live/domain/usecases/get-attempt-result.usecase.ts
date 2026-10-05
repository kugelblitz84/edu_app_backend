import { Injectable, NotFoundException } from '@nestjs/common';
import { LiveExamRepository } from '../contracts/live-exam.repository';

@Injectable()
export class GetAttemptResultUseCase {
  constructor(private readonly repository: LiveExamRepository) {}

  async execute(attemptId: string, userId: string) {
    const result = await this.repository.findResult(attemptId, userId);
    if (!result) throw new NotFoundException('Attempt result not found.');
    return result;
  }
}
