import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { PrismaRegisterUserRepository } from './data/repositories/register-user.repository';
import { ScryptPasswordHasher } from './data/services/scrypt-password-hasher.service';
import { PasswordHasher } from './domain/contracts/password-hasher.service';
import { RegisterUserRepository } from './domain/contracts/register-user.repository';
import { RegisterUserUseCase } from './domain/use-cases/register-user.use-case';
import { RegisterController } from './presentation/controllers/register.controller';

@Module({
  imports: [PrismaModule],
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
      provide: RegisterUserUseCase,
      useFactory: (
        repository: RegisterUserRepository,
        passwordHasher: PasswordHasher,
      ) => new RegisterUserUseCase(repository, passwordHasher),
      inject: [RegisterUserRepository, PasswordHasher],
    },
  ],
})
export class RegisterModule {}
