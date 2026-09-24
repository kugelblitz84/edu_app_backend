import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../../../core/auth/auth.types';
import { CurrentUser } from '../../../../../core/auth/decorators/current-user.decorator';
import { Public } from '../../../../../core/auth/decorators/public.decorator';
import { SessionService } from '../../../../../core/auth/services/session.service';
import {
  APP_CONFIG,
  type AppConfig,
} from '../../../../../core/config/app-config';
import { ZodValidationPipe } from '../../../../../core/validator/zod-validation.pipe';
import {
  InvalidAccessTokenError,
  InvalidCurrentPasswordError,
  InvalidResetTokenError,
} from '../../domain/errors/pass-reset.errors';
import {
  PassResetUseCase,
  RESET_REQUEST_MESSAGE,
} from '../../domain/use-cases/pass-reset.usecase';
import {
  authenticatedPassResetSchema,
  type AuthenticatedPassResetDto,
  confirmPassResetSchema,
  type ConfirmPassResetDto,
  requestPassResetSchema,
  type RequestPassResetDto,
} from '../dto/pass-reset-requests.dto';

interface RateWindow {
  count: number;
  resetsAt: number;
}

@Controller({ path: 'auth/password-reset', version: '1' })
export class PassResetController {
  private readonly logger = new Logger(PassResetController.name);
  private readonly attempts = new Map<string, RateWindow>();

  constructor(
    private readonly passReset: PassResetUseCase,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('request')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async request(
    @Body(new ZodValidationPipe(requestPassResetSchema))
    input: RequestPassResetDto,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    this.enforceRateLimit(`email:${request.ip}:${input.email}`, 5, 15 * 60_000);
    const startedAt = Date.now();
    try {
      await this.passReset.requestByEmail(input.email);
    } catch (error) {
      this.logger.error(
        'Password reset request processing failed.',
        error instanceof Error ? error.stack : undefined,
      );
    }
    await this.minimumResponseTime(startedAt, 300);
    return { message: RESET_REQUEST_MESSAGE };
  }

  @Post('confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Body(new ZodValidationPipe(confirmPassResetSchema))
    input: ConfirmPassResetDto,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    this.enforceRateLimit(`token:${request.ip}`, 10, 15 * 60_000);
    try {
      const userId = await this.passReset.confirm(input.token, input.newPassword);
      await this.sessions.deleteForUser(userId);
      return { message: 'Password changed successfully.' };
    } catch (error) {
      if (error instanceof InvalidResetTokenError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post('change')
  @HttpCode(HttpStatus.OK)
  async changeAuthenticated(
    @Body(new ZodValidationPipe(authenticatedPassResetSchema))
    input: AuthenticatedPassResetDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ status: string; message: string }> {
    this.enforceRateLimit(`change:${request.ip}`, 5, 15 * 60_000);
    const rawRegion = request.get(this.config.auth.ipRegionHeader)?.trim();

    try {
      const result = await this.passReset.changeAuthenticated({
        userId: currentUser.userId,
        accessTokenIssuedAt: currentUser.issuedAt,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        ipAddress: request.ip,
        ipRegion: rawRegion ? rawRegion.toUpperCase() : undefined,
      });
      if (result === 'password_changed') {
        await this.sessions.deleteForUser(currentUser.userId);
      }
      return result === 'password_changed'
        ? {
            status: result,
            message: 'Password changed successfully. Please sign in again.',
          }
        : {
            status: result,
            message:
              'Your network context changed. A password reset link was sent to your email.',
          };
    } catch (error) {
      if (
        error instanceof InvalidAccessTokenError ||
        error instanceof InvalidCurrentPasswordError
      ) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  private enforceRateLimit(
    rawKey: string,
    limit: number,
    windowMilliseconds: number,
  ): void {
    const key = createHash('sha256').update(rawKey).digest('hex');
    const now = Date.now();
    const current = this.attempts.get(key);
    if (!current || current.resetsAt <= now) {
      if (!current && this.attempts.size >= 10_000) {
        throw new HttpException(
          'Too many password reset attempts. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.attempts.set(key, { count: 1, resetsAt: now + windowMilliseconds });
      return;
    }
    current.count += 1;
    if (current.count > limit) {
      throw new HttpException(
        'Too many password reset attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async minimumResponseTime(startedAt: number, minimumMs: number) {
    const remaining = minimumMs - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }
}
