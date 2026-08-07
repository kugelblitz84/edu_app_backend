import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { PrismaLoginUserRepository } from './data/repositories/login-user.repository';
import { JwtTokenGenerator } from './data/services/jwt-token-generator.service';
import { ScryptPasswordVerifier } from './data/services/scrypt-password-verifier.service';
import { LoginUserRepository } from './domain/contracts/login-user.repository';
import { PasswordVerifier } from './domain/contracts/password-verifier.service';
import { TokenGenerator } from './domain/contracts/token-generator.service';
import { LoginUseCase } from './domain/usecases/login.usecase';
import { LoginController } from './presentation/login.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LoginController],
  providers: [
    {
      provide: LoginUserRepository,
      useClass: PrismaLoginUserRepository,
    },
    {
      provide: PasswordVerifier,
      useClass: ScryptPasswordVerifier,
    },
    {
      provide: TokenGenerator,
      useClass: JwtTokenGenerator,
    },
    {
      provide: LoginUseCase,
      useFactory: (
        repository: LoginUserRepository,
        passwordVerifier: PasswordVerifier,
        tokenGenerator: TokenGenerator,
      ) => new LoginUseCase(repository, passwordVerifier, tokenGenerator),
      inject: [LoginUserRepository, PasswordVerifier, TokenGenerator],
    },
  ],
})
export class LoginModule {}
