import { Module } from '@nestjs/common';
import { ConfigModule } from '../core/config/config.module';
import { AuthModule } from '../features/auth/auth.module';
import { HealthModule } from '../features/health/health.module';

@Module({
  imports: [ConfigModule, HealthModule, AuthModule],
})
export class AppModule {}
