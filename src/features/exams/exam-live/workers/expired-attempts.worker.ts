import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LiveExamRealtimePublisher } from '../domain/contracts/live-exam-realtime.publisher';
import { LiveExamRepository } from '../domain/contracts/live-exam.repository';
import { GradeAttemptUseCase } from '../domain/usecases/grade-attempt.usecase';

@Injectable()
export class ExpiredAttemptsWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly repository: LiveExamRepository,
    private readonly grader: GradeAttemptUseCase,
    private readonly realtime: LiveExamRealtimePublisher,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 10_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.repository.claimExpired(new Date(), 100);
      for (const attempt of expired) {
        this.realtime.attemptExpired(attempt.userId, attempt.id);
      }
      const pending = await this.repository.findPendingGrading(100);
      for (const attempt of pending) {
        const result = await this.grader.execute(attempt.id);
        if (result) this.realtime.attemptGraded(attempt.userId, attempt.id);
      }
    } finally {
      this.running = false;
    }
  }
}
