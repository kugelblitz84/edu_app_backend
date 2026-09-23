import { Module } from '@nestjs/common';
import { ConfigModule } from '../core/config/config.module';
import { MongooseModule } from '../core/database/mongoose.module';
import { AuthModule } from '../features/auth/auth.module';
import { GlobalAdminModule } from '../features/global_admin/global-admin.module';
import { HealthModule } from '../features/health/health.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule,
    HealthModule,
    AuthModule,
    GlobalAdminModule,
  ],
})
export class AppModule {}
