import { Module } from '@nestjs/common';
import { AuthModule } from '../../../core/auth/auth.module';
import { APP_CONFIG, type AppConfig } from '../../../core/config/app-config';
import { PrismaModule } from '../../../core/database/prisma.module';
import { MailModule } from '../../../core/mail/mail.module';
import { ScryptPasswordVerifier } from '../login/data/services/scrypt-password-verifier.service';
import { PasswordVerifier } from '../login/domain/contracts/password-verifier.service';
import { ScryptPasswordHasher } from '../register/data/services/scrypt-password-hasher.service';
import { PasswordHasher } from '../register/domain/contracts/password-hasher.service';
import { PrismaPassResetRepository } from './data/repositories/prisma-pass-reset.repository';
import { PassResetMailerService as PassResetMailerAdapter } from './data/services/pass-reset-mailer.service';
import { PassResetMailerService } from './domain/contracts/pass-reset-mailer.service';
import { PassResetRepository } from './domain/contracts/pass-reset.repository';
import { PassResetUseCase } from './domain/use-cases/pass-reset.usecase';
import { PassResetController } from './presentation/controllers/pass-reset.controller';

@Module({
  imports: [AuthModule, PrismaModule, MailModule],
  controllers: [PassResetController],
  providers: [
    { provide: PassResetRepository, useClass: PrismaPassResetRepository },
    { provide: PasswordHasher, useClass: ScryptPasswordHasher },
    { provide: PasswordVerifier, useClass: ScryptPasswordVerifier },
    {
      provide: PassResetMailerService,
      useClass: PassResetMailerAdapter,
    },
    {
      provide: PassResetUseCase,
      useFactory: (
        // configenv: true,
        repository: PassResetRepository,
        hasher: PasswordHasher,
        verifier: PasswordVerifier,
        mailer: PassResetMailerService,
        config: AppConfig,
      ) =>
        new PassResetUseCase(
          repository,
          hasher,
          verifier,
          mailer,
          config.auth.passwordResetTtlSeconds,
        ),
      inject: [
        PassResetRepository,
        PasswordHasher,
        PasswordVerifier,
        PassResetMailerService,
        APP_CONFIG,
      ],
    },
  ],
})
export class PassResetModule {}
