import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { TokenModule } from '../../../core/token/token.module';
import { PrismaRegisterUserRepository } from './data/repositories/register-user.repository';
import { PrismaRegisterInstitutionRepository } from './data/repositories/register-institution.repository';
import { ScryptPasswordHasher } from './data/services/scrypt-password-hasher.service';
import { RegisterInstitutionRepository } from './domain/contracts/register-institution.repository';
import { PasswordHasher } from './domain/contracts/password-hasher.service';
import { normalizer } from './domain/contracts/normalizer.service';
import { RegisterUserRepository } from './domain/contracts/register-user.repository';
import { RegisterUserUseCase } from './domain/use-cases/register-user.use-case';
import { RegisterInstitutionUseCase } from './domain/use-cases/register-institution.use-case';
import { RegisterController } from './presentation/controllers/register.controller';
import { NormalizeAndValidateServiceImpl } from './data/services/normalize-and-validate.service';

@Module({
  imports: [PrismaModule, TokenModule],
  controllers: [RegisterController],
  providers: [
    {
      provide: PasswordHasher,
      useClass: ScryptPasswordHasher,
    },
    {
      provide: RegisterUserRepository,
      useClass: PrismaRegisterUserRepository,
    },
    {
      provide: RegisterInstitutionRepository,
      useClass: PrismaRegisterInstitutionRepository,
    },
    {
      provide: normalizer,
      useClass: NormalizeAndValidateServiceImpl,
    },
    {
      provide: RegisterUserUseCase,
      useFactory: (
        repository: RegisterUserRepository,
        passwordHasher: PasswordHasher,
        normalizer: normalizer,
      ) => new RegisterUserUseCase(repository, passwordHasher, normalizer),
      inject: [RegisterUserRepository, PasswordHasher, normalizer],
    },
    {
      provide: RegisterInstitutionUseCase,
      useFactory: (repository: RegisterInstitutionRepository) =>
        new RegisterInstitutionUseCase(repository),
      inject: [RegisterInstitutionRepository],
    },
  ],
})
export class RegisterModule {}
