import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { PrismaGlobalAdminRepository } from './data/repository.inpl';
import { RandomInstitutionCodeGenerator } from './data/services';
import { GlobalAdminRepository } from './domain/contracts/repositories';
import { InstitutionCodeGenerator } from './domain/contracts/services';
import { GlobalAdminUseCases } from './domain/usecases';
import { GlobalAdminController } from './presentation/global-admin.controller';

@Module({
  imports: [PrismaModule],
  providers: [
    GlobalAdminUseCases,
    { provide: GlobalAdminRepository, useClass: PrismaGlobalAdminRepository },
    {
      provide: InstitutionCodeGenerator,
      useClass: RandomInstitutionCodeGenerator,
    },
  ],
  controllers: [GlobalAdminController],
})
export class GlobalAdminModule {}
