import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../../../core/auth/auth.types';
import { CurrentUser } from '../../../../../core/auth/decorators/current-user.decorator';
import { Public } from '../../../../../core/auth/decorators/public.decorator';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { RateLimitService } from '../../../../../core/auth/services/rate-limit.service';
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

@Controller({ path: 'auth/password-reset', version: '1' })
export class PassResetController {
  private readonly logger = new Logger(PassResetController.name);

  constructor(
    private readonly passReset: PassResetUseCase,
    private readonly sessions: SessionService,
    private readonly rateLimits: RateLimitService,
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
    await this.rateLimits.enforce(
      'password-reset-request',
      `${request.ip ?? 'unknown'}:${input.email.trim().toLowerCase()}`,
      5,
      15 * 60_000,
      'Too many password reset attempts. Please try again later.',
    );
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
    await this.rateLimits.enforce(
      'password-reset-confirm',
      request.ip ?? 'unknown',
      10,
      15 * 60_000,
      'Too many password reset attempts. Please try again later.',
    );
    try {
      const userId = await this.passReset.confirm(
        input.token,
        input.newPassword,
      );
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
    await this.rateLimits.enforce(
      'password-reset-change',
      request.ip ?? 'unknown',
      5,
      15 * 60_000,
      'Too many password reset attempts. Please try again later.',
    );
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

  private async minimumResponseTime(startedAt: number, minimumMs: number) {
    const remaining = minimumMs - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }
}
