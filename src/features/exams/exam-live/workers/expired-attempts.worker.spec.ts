import { Logger } from '@nestjs/common';
import { LiveExamRealtimePublisher } from '../domain/contracts/live-exam-realtime.publisher';
import { LiveExamRepository } from '../domain/contracts/live-exam.repository';
import { GradeAttemptUseCase } from '../domain/usecases/grade-attempt.usecase';
import { ExpiredAttemptsWorker } from './expired-attempts.worker';

describe(ExpiredAttemptsWorker.name, () => {
  it('continues grading the batch when one attempt fails', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const attempts = [
      { id: 'attempt-1', userId: 'user-1' },
      { id: 'attempt-2', userId: 'user-2' },
    ];
    const repository = {
      claimExpired: jest.fn().mockResolvedValue([]),
      findPendingGrading: jest.fn().mockResolvedValue(attempts),
    } as unknown as jest.Mocked<LiveExamRepository>;
    const execute = jest
      .fn()
      .mockRejectedValueOnce(new Error('MongoDB unavailable'))
      .mockResolvedValueOnce({ attemptId: attempts[1].id });
    const grader = { execute } as unknown as jest.Mocked<GradeAttemptUseCase>;
    const attemptGraded = jest.fn();
    const realtime = {
      attemptExpired: jest.fn(),
      attemptSubmitted: jest.fn(),
      attemptGraded,
    } as jest.Mocked<LiveExamRealtimePublisher>;
    const worker = new ExpiredAttemptsWorker(repository, grader, realtime);

    await expect(
      (
        worker as unknown as {
          tick(): Promise<void>;
        }
      ).tick(),
    ).resolves.toBeUndefined();

    expect(execute).toHaveBeenCalledTimes(2);
    expect(attemptGraded).toHaveBeenCalledWith(
      attempts[1].userId,
      attempts[1].id,
    );
    log.mockRestore();
  });
});
