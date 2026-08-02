import { Injectable } from '@nestjs/common';
import {
  SystemStatusService,
  SystemStatusSnapshot,
} from '../../domain/contracts/system-status-abstract.service';

@Injectable()
export class ProcessSystemStatusService extends SystemStatusService {
  getSnapshot(): SystemStatusSnapshot {
    return {
      timestamp: new Date(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
