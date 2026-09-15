import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { TokenModule } from '../../../core/token/token.module';
import { TokenService } from '../../../core/token/token.service';
import { PrismaLoginUserRepository } from './data/repositories/login-user.repository';
import { ScryptPasswordVerifier } from './data/services/scrypt-password-verifier.service';
import { LoginUserRepository } from './domain/contracts/login-user.repository';
import { PasswordVerifier } from './domain/contracts/password-verifier.service';
import { LoginUseCase } from './domain/usecases/login.usecase';
import { LoginController } from './presentation/login.controller';

@Module({
  imports: [PrismaModule, TokenModule],
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
      provide: LoginUseCase,
      useFactory: (
        repository: LoginUserRepository,
        passwordVerifier: PasswordVerifier,
        tokenService: TokenService,
      ) => new LoginUseCase(repository, passwordVerifier, tokenService),
      inject: [LoginUserRepository, PasswordVerifier, TokenService],
    },
  ],
})
export class LoginModule {}
