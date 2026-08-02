import { Injectable } from '@nestjs/common';
import {
  SystemStatusProvider,
  SystemStatusSnapshot,
} from '../../domain/contracts/system-status.provider';

@Injectable()
export class ProcessSystemStatusProvider extends SystemStatusProvider {
  getSnapshot(): SystemStatusSnapshot {
    return {
      timestamp: new Date(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
