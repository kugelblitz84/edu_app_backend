import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';

interface RedisCompatibleSocketServer {
  adapter(adapter: ReturnType<typeof createAdapter>): void;
}

export class RedisIoAdapter extends IoAdapter {
  private publisher?: RedisClientType;
  private subscriber?: RedisClientType;

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  async connect(): Promise<void> {
    const publisher = createClient({ url: this.redisUrl });
    const subscriber = publisher.duplicate();
    try {
      await Promise.all([publisher.connect(), subscriber.connect()]);
      this.publisher = publisher;
      this.subscriber = subscriber;
    } catch (error) {
      await Promise.allSettled([publisher.close(), subscriber.close()]);
      throw error;
    }
  }

  createIOServer(port: number, options?: unknown): RedisCompatibleSocketServer {
    const server = super.createIOServer(
      port,
      options,
    ) as unknown as RedisCompatibleSocketServer;
    if (!this.publisher || !this.subscriber) {
      throw new Error('The Redis Socket.IO adapter is not connected.');
    }
    server.adapter(createAdapter(this.publisher, this.subscriber));
    return server;
  }

  async close(server: Parameters<IoAdapter['close']>[0]): Promise<void> {
    await super.close(server);
    const clients = [this.publisher, this.subscriber].filter(
      (client): client is RedisClientType =>
        client !== undefined && client.isOpen,
    );
    await Promise.allSettled(clients.map((client) => client.quit()));
  }
}
