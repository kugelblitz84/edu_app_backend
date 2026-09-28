import { Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { LiveExamRepository } from '../domain/contracts/live-exam.repository';
import { SaveAnswerUseCase } from '../domain/usecases/save-answer.usecase';
import {
  joinAttemptSchema,
  saveAnswerSchema,
} from '../presentation/live-exam.dto';
import { SocketAuthService } from './socket-auth.service';
import { LiveExamSocketServerRef } from './socket-server.ref';

@Injectable()
@WebSocketGateway({ namespace: '/exam-live', maxHttpBufferSize: 16_384 })
export class LiveExamGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;
  private readonly traffic = new Map<
    string,
    { second: number; count: number }
  >();

  constructor(
    private readonly auth: SocketAuthService,
    private readonly repository: LiveExamRepository,
    private readonly saveAnswer: SaveAnswerUseCase,
    private readonly serverRef: LiveExamSocketServerRef,
  ) {}

  afterInit(server: Server): void {
    this.serverRef.set(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.auth.authenticate(client);
    await client.join(`user:${user.userId}`);
  }

  handleDisconnect(client: Socket): void {
    this.traffic.delete(client.id);
  }

  @SubscribeMessage('attempt.join')
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    const user = await this.auth.revalidate(client);
    const parsed = joinAttemptSchema.safeParse(payload);
    if (!parsed.success) throw new WsException('Invalid attempt.join payload');
    const attempt = await this.repository.findOwned(
      parsed.data.attemptId,
      user.userId,
    );
    if (!attempt) throw new WsException('Attempt not found');
    await client.join(`attempt:${attempt.id}`);
    return { attemptId: attempt.id, status: attempt.status };
  }

  @SubscribeMessage('answer.save')
  async save(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    this.enforceRateLimit(client);
    const user = await this.auth.revalidate(client);
    const parsed = saveAnswerSchema.safeParse(payload);
    if (!parsed.success) throw new WsException('Invalid answer.save payload');
    try {
      return await this.saveAnswer.execute({
        attemptId: parsed.data.attemptId,
        userId: user.userId,
        questionId: parsed.data.questionId,
        selectedOptionIds: parsed.data.answer.selectedOptionIds,
        revision: parsed.data.revision,
      });
    } catch (error) {
      throw new WsException(
        error instanceof Error ? error.message : 'Unable to save answer',
      );
    }
  }

  private enforceRateLimit(client: Socket): void {
    const second = Math.floor(Date.now() / 1000);
    const current = this.traffic.get(client.id);
    if (!current || current.second !== second) {
      this.traffic.set(client.id, { second, count: 1 });
      return;
    }
    current.count += 1;
    if (current.count > 20) throw new WsException('Rate limit exceeded');
  }
}
