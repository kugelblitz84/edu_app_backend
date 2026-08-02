import { Controller, Get } from '@nestjs/common';
import { GetHealthStatusUseCase } from '../../domain/use-cases/get-health-status.use-case';
import { toHealthResponseDto } from '../dto/health-response.dto';
import type { HealthResponseDto } from '../dto/health-response.dto';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly getHealthStatus: GetHealthStatusUseCase) {}

  @Get()
  getStatus(): HealthResponseDto {
    return toHealthResponseDto(this.getHealthStatus.execute());
  }
}
