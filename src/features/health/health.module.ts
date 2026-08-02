import { Module } from '@nestjs/common';
import { ProcessSystemStatusProvider } from './data/providers/process-system-status.provider';
import { SystemStatusProvider } from './domain/contracts/system-status.provider';
import { GetHealthStatusUseCase } from './domain/use-cases/get-health-status.use-case';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: SystemStatusProvider,
      useClass: ProcessSystemStatusProvider,
    },
    {
      provide: GetHealthStatusUseCase,
      useFactory: (provider: SystemStatusProvider) =>
        new GetHealthStatusUseCase(provider),
      inject: [SystemStatusProvider],
    },
  ],
})
export class HealthModule {}
