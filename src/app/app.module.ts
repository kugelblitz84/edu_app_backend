import { Module } from '@nestjs/common';
import { AuthModule as CoreAuthModule } from '../core/auth/auth.module';
import { ConfigModule } from '../core/config/config.module';
import { MongooseModule } from '../core/database/mongoose.module';
import { AuthModule } from '../features/auth/auth.module';
import { GlobalAdminModule } from '../features/global_admin/global-admin.module';
import { HealthModule } from '../features/health/health.module';
import { ExamModule } from '../features/exams/exam.module';

@Module({
  imports: [
    ConfigModule,
    CoreAuthModule,
    MongooseModule,
    HealthModule,
    AuthModule,
    GlobalAdminModule,
    ExamModule,
  ],
})
export class AppModule {}
