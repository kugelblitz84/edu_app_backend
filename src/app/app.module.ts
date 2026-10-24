import { Module } from '@nestjs/common';
import { AuthModule as CoreAuthModule } from '../core/auth/auth.module';
import { ConfigModule } from '../core/config/config.module';
import { MongooseModule } from '../core/database/mongoose.module';
import { ArticleModule } from '../features/articles/article.module';
import { AuthModule } from '../features/auth/auth.module';
import { ExamModule } from '../features/exams/exam.module';
import { GlobalAdminModule } from '../features/global_admin/global-admin.module';
import { HealthModule } from '../features/health/health.module';
import { InstitutionModule } from '../features/institutions/institution.module';
import { ResourceModule } from '../features/Resources/resource.module';
import { UserProfileModule } from '../features/user-profile/user-profile.module';

@Module({
  imports: [
    ConfigModule,
    CoreAuthModule,
    MongooseModule,
    HealthModule,
    AuthModule,
    GlobalAdminModule,
    InstitutionModule,
    ExamModule,
    UserProfileModule,
    ResourceModule,
    ArticleModule,
  ],
})
export class AppModule {}
