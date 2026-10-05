import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class LiveExamSocketServerRef {
  private value?: Server;

  set(server: Server): void {
    this.value = server;
  }

  get server(): Server | undefined {
    return this.value;
  }
}
