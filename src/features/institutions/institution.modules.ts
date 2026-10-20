import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { PrismaInstitutionRepository } from './data/institution.repository';
import { InstitutionRepository } from './domain/institution.contracts';
import { InstitutionUseCases } from './domain/institution.usecases';
import { InstitutionController } from './presentation/institution.controllers';

@Module({
  imports: [PrismaModule],
  providers: [
    InstitutionUseCases,
    {
      provide: InstitutionRepository,
      useClass: PrismaInstitutionRepository,
    },
  ],
  controllers: [InstitutionController],
  exports: [InstitutionUseCases, InstitutionRepository],
})
export class InstitutionModule {}
// import { Module } from '@nestjs/common';
// import { PrismaModule } from '../../core/database/prisma.module';
// import { PrismaInstitutionRepository } from './data/institution.repository';
// import { InstitutionRepository } from './domain/institution.contracts';
// import { InstitutionUseCases } from './domain/institution.usecases';
// import { InstitutionController } from './presentation/institution.controllers';

// @Module({
//   imports: [PrismaModule],
//   providers: [
//     InstitutionUseCases,
//     {
//       provide: InstitutionRepository,
//       useClass: PrismaInstitutionRepository,
//     },
//   ],
//   controllers: [InstitutionController],
//   exports: [InstitutionUseCases, InstitutionRepository],
// })
// export class InstitutionModule {}
