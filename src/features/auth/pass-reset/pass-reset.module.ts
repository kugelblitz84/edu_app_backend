import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../core/config/app-config';
import { PrismaModule } from '../../../core/database/prisma.module';
import { MailModule } from '../../../core/mail/mail.module';
import { ScryptPasswordVerifier } from '../login/data/services/scrypt-password-verifier.service';
import { PasswordVerifier } from '../login/domain/contracts/password-verifier.service';
import { ScryptPasswordHasher } from '../register/data/services/scrypt-password-hasher.service';
import { PasswordHasher } from '../register/domain/contracts/password-hasher.service';
import { PrismaPassResetRepository } from './data/repositories/prisma-pass-reset.repository';
import { PassResetMailerService as PassResetMailerAdapter } from './data/services/pass-reset-mailer.service';
import { Sha256AccessTokenVerifier } from './data/services/sha256-access-token-verifier.service';
import { AccessTokenVerifier } from './domain/contracts/access-token-verifier.service';
import { PassResetMailerService } from './domain/contracts/pass-reset-mailer.service';
import { PassResetRepository } from './domain/contracts/pass-reset.repository';
import { PassResetUseCase } from './domain/use-cases/pass-reset.usecase';
import { PassResetController } from './presentation/controllers/pass-reset.controller';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [PassResetController],
  providers: [
    { provide: PassResetRepository, useClass: PrismaPassResetRepository },
    { provide: PasswordHasher, useClass: ScryptPasswordHasher },
    { provide: PasswordVerifier, useClass: ScryptPasswordVerifier },
    { provide: AccessTokenVerifier, useClass: Sha256AccessTokenVerifier },
    {
      provide: PassResetMailerService,
      useClass: PassResetMailerAdapter,
    },
    {
      provide: PassResetUseCase,
      useFactory: (
        repository: PassResetRepository,
        hasher: PasswordHasher,
        verifier: PasswordVerifier,
        tokenVerifier: AccessTokenVerifier,
        mailer: PassResetMailerService,
        config: AppConfig,
      ) =>
        new PassResetUseCase(
          repository,
          hasher,
          verifier,
          tokenVerifier,
          mailer,
          config.auth.passwordResetTtlSeconds,
        ),
      inject: [
        PassResetRepository,
        PasswordHasher,
        PasswordVerifier,
        AccessTokenVerifier,
        PassResetMailerService,
        APP_CONFIG,
      ],
    },
  ],
})
export class PassResetModule {}
