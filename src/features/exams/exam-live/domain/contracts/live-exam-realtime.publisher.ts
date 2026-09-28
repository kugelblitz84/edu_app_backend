export abstract class LiveExamRealtimePublisher {
  abstract attemptExpired(userId: string, attemptId: string): void;
  abstract attemptSubmitted(userId: string, attemptId: string): void;
  abstract attemptGraded(userId: string, attemptId: string): void;
}
