import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../validator/zod-validation.pipe';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import {
  InvalidRefreshTokenError,
  SessionService,
} from './services/session.service';
import { RateLimitService } from './services/rate-limit.service';

const refreshTokenRequestSchema = z
  .object({
    refreshToken: z
      .string({ error: 'Refresh token is required.' })
      .min(1, 'Refresh token is required.')
      .max(128, 'Refresh token is invalid.'),
  })
  .strict();

type RefreshTokenRequestDto = z.infer<typeof refreshTokenRequestSchema>;

export interface RefreshTokenResponseDto {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly sessions: SessionService,
    private readonly rateLimits: RateLimitService,
  ) {}

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() currentUser: AuthenticatedUser): Promise<void> {
    await this.sessions.revoke(currentUser.sessionId, currentUser.userId);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema))
    input: RefreshTokenRequestDto,
    @Req() request: Request,
  ): Promise<RefreshTokenResponseDto> {
    await this.rateLimits.enforce(
      'auth-refresh-ip',
      request.ip ?? 'unknown',
      30,
      15 * 60_000,
      'Too many refresh attempts. Please try again later.',
    );
    try {
      const tokens = await this.sessions.rotate(input.refreshToken, {
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresIn: tokens.accessTokenExpiresIn,
      };
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
