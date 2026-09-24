import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { AuthModule } from '../../../core/auth/auth.module';
import { SessionService } from '../../../core/auth/services/session.service';
import { PrismaLoginUserRepository } from './data/repositories/login-user.repository';
import { ScryptPasswordVerifier } from './data/services/scrypt-password-verifier.service';
import { LoginUserRepository } from './domain/contracts/login-user.repository';
import { PasswordVerifier } from './domain/contracts/password-verifier.service';
import { LoginUseCase } from './domain/usecases/login.usecase';
import { LoginController } from './presentation/login.controller';

@Module({
  imports: [PrismaModule, AuthModule],
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
        sessions: SessionService,
      ) => new LoginUseCase(repository, passwordVerifier, sessions),
      inject: [LoginUserRepository, PasswordVerifier, SessionService],
    },
  ],
})
export class LoginModule {}
