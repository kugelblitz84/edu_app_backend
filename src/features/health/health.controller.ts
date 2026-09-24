import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import type { HealthResponse } from './health.service';
import { Public } from '../../core/auth/decorators/public.decorator';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('status')
  @Public()
  getStatus(): HealthResponse {
    return this.healthService.getStatus();
  }
}
