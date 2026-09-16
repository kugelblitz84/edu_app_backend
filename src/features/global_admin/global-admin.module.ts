import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { TokenModule } from '../../core/token/token.module';
import { PrismaGlobalAdminRepository } from './data/repository.inpl';
import { RandomInstitutionCodeGenerator } from './data/services';
import { GlobalAdminRepository } from './domain/contracts/repositories';
import { InstitutionCodeGenerator } from './domain/contracts/services';
import { GlobalAdminUseCases } from './domain/usecases';
import { GlobalAdminAuthMiddleware } from './presentation/global-admin-auth.middleware';
import { GlobalAdminController } from './presentation/global-admin.controller';

@Module({
  imports: [TokenModule, PrismaModule],
  providers: [
    GlobalAdminAuthMiddleware,
    GlobalAdminUseCases,
    { provide: GlobalAdminRepository, useClass: PrismaGlobalAdminRepository },
    {
      provide: InstitutionCodeGenerator,
      useClass: RandomInstitutionCodeGenerator,
    },
  ],
  controllers: [GlobalAdminController],
})
export class GlobalAdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(GlobalAdminAuthMiddleware).forRoutes(GlobalAdminController);
  }
}
