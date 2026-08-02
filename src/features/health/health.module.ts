import { Module } from '@nestjs/common';
import { ProcessSystemStatusService } from './data/providers/process-system-status.provider';
import { SystemStatusService } from './domain/contracts/system-status.provider';
import { GetHealthStatusUseCase } from './domain/use-cases/get-health-status.use-case';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: SystemStatusService,
      useClass: ProcessSystemStatusService,
    },
    {
      provide: GetHealthStatusUseCase,
      useFactory: (provider: SystemStatusService) =>
        new GetHealthStatusUseCase(provider),
      inject: [SystemStatusService],
    },
  ],
})
export class HealthModule {}
