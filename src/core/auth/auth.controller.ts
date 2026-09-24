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
import { Public } from './decorators/public.decorator';
import {
  InvalidRefreshTokenError,
  SessionService,
} from './services/session.service';

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
  constructor(private readonly sessions: SessionService) {}

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema))
    input: RefreshTokenRequestDto,
    @Req() request: Request,
  ): Promise<RefreshTokenResponseDto> {
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
