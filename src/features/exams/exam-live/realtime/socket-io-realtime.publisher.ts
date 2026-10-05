import { Injectable } from '@nestjs/common';
import { LiveExamRealtimePublisher } from '../domain/contracts/live-exam-realtime.publisher';
import { LiveExamSocketServerRef } from './socket-server.ref';

@Injectable()
export class SocketIoLiveExamRealtimePublisher implements LiveExamRealtimePublisher {
  constructor(private readonly serverRef: LiveExamSocketServerRef) {}

  attemptExpired(userId: string, attemptId: string): void {
    this.emit(userId, attemptId, 'attempt.expired');
  }

  attemptSubmitted(userId: string, attemptId: string): void {
    this.emit(userId, attemptId, 'attempt.submitted');
  }

  attemptGraded(userId: string, attemptId: string): void {
    this.emit(userId, attemptId, 'attempt.graded');
  }

  private emit(userId: string, attemptId: string, event: string): void {
    const payload = { attemptId };
    this.serverRef.server?.to(`user:${userId}`).emit(event, payload);
    this.serverRef.server?.to(`attempt:${attemptId}`).emit(event, payload);
  }
}
