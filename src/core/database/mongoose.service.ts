import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { type Connection, createConnection } from 'mongoose';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

@Injectable()
export class MongooseService implements OnModuleInit, OnModuleDestroy {
  private mongooseConnection?: Connection;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get connection(): Connection {
    if (!this.mongooseConnection) {
      throw new Error('MongoDB connection has not been initialized.');
    }

    return this.mongooseConnection;
  }

  async onModuleInit(): Promise<void> {
    this.mongooseConnection = await createConnection(
      this.config.mongodbUrl,
    ).asPromise();
  }

  async onModuleDestroy(): Promise<void> {
    await this.mongooseConnection?.close();
  }
}
