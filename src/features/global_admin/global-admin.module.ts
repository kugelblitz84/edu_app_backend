import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { ArticleModule } from '../articles/article.module';
import { PrismaGlobalAdminRepository } from './data/repository.inpl';
import { RandomInstitutionCodeGenerator } from './data/services';
import { GlobalAdminRepository } from './domain/contracts/repositories';
import { InstitutionCodeGenerator } from './domain/contracts/services';
import { GlobalAdminUseCases } from './domain/usecases';
import { GlobalAdminArticleController } from './presentation/global-admin-article.controller';
import { GlobalAdminController } from './presentation/global-admin.controller';

@Module({
  imports: [PrismaModule, ArticleModule],
  providers: [
    GlobalAdminUseCases,
    { provide: GlobalAdminRepository, useClass: PrismaGlobalAdminRepository },
    {
      provide: InstitutionCodeGenerator,
      useClass: RandomInstitutionCodeGenerator,
    },
  ],
  controllers: [GlobalAdminController, GlobalAdminArticleController],
})
export class GlobalAdminModule {}
