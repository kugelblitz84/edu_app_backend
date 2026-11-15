import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../database/prisma.module';
import { AuthController } from './auth.controller';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RolesGuard } from './guards/roles.guard';
import { AccessTokenService } from './services/access-token.service';
import { SessionService } from './services/session.service';
import { RateLimitService } from './services/rate-limit.service';
import { AuthCookieService } from './services/auth-cookie.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AccessTokenService,
    AuthCookieService,
    SessionService,
    RateLimitService,
    RolesGuard,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
  exports: [
    AccessTokenService,
    AuthCookieService,
    SessionService,
    RateLimitService,
    RolesGuard,
  ],
})
export class AuthModule {}
