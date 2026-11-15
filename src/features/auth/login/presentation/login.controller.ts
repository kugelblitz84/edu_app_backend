import {
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthCookieService } from '../../../../core/auth/services/auth-cookie.service';
import { Public } from '../../../../core/auth/decorators/public.decorator';
import { SessionService } from '../../../../core/auth/services/session.service';
import { RateLimitService } from '../../../../core/auth/services/rate-limit.service';
import { APP_CONFIG, type AppConfig } from '../../../../core/config/app-config';
import { ZodValidationPipe } from '../../../../core/validator/zod-validation.pipe';
import {
  InvalidCredentialsError,
  LoginNotAllowedError,
} from '../domain/errors/login.error';
import { LoginUseCase } from '../domain/usecases/login.usecase';
import {
  loginRequestSchema,
  type LoginRequestDto,
  type LoginResponseDto,
  toLoginResponseDto,
} from './login.dto';

@Controller({ path: 'auth', version: '1' })
export class LoginController {
  constructor(
    private readonly loginUser: LoginUseCase,
    private readonly rateLimits: RateLimitService,
    private readonly authCookies: AuthCookieService,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @Public()
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) request: LoginRequestDto,
    @Req() httpRequest: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const normalizedUsername = request.username.trim().toLowerCase();
    await Promise.all([
      this.rateLimits.enforce(
        'auth-login-ip',
        httpRequest.ip ?? 'unknown',
        20,
        15 * 60_000,
        'Too many login attempts. Please try again later.',
      ),
      this.rateLimits.enforce(
        'auth-login-account',
        normalizedUsername,
        10,
        15 * 60_000,
        'Too many login attempts. Please try again later.',
      ),
    ]);
    try {
      const region = httpRequest.get(this.config.auth.ipRegionHeader)?.trim();
      const loggedInUser = await this.loginUser.execute(request, {
        ipAddress: httpRequest.ip,
        ipRegion: region ? region.toUpperCase() : undefined,
        userAgent: httpRequest.get('user-agent'),
      });
      const sessionId = this.sessions.sessionIdFromRefreshToken(
        loggedInUser.refreshToken,
      );
      this.authCookies.setRefreshToken(
        response,
        loggedInUser.refreshToken,
        loggedInUser.refreshTokenExpiresAt,
      );
      response.setHeader('Cache-Control', 'no-store');

      return toLoginResponseDto(
        loggedInUser,
        this.authCookies.issueCsrfToken(sessionId),
      );
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException('Invalid username or password.');
      }

      if (error instanceof LoginNotAllowedError) {
        throw new ForbiddenException('This account is not active.');
      }

      throw error;
    }
  }
}
