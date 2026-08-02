import { Module } from '@nestjs/common';
import { appConfigProvider } from '../core/config/app-config';
import { HealthModule } from '../features/health/health.module';

@Module({
  imports: [HealthModule],
  providers: [appConfigProvider],
})
export class AppModule {}
