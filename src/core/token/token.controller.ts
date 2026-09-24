import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../validator/zod-validation.pipe';
import { TokenService } from './token.service';

const refreshTokenRequestSchema = z
  .object({
    refreshToken: z
      .string({ error: 'Refresh token is required.' })
      .min(1, 'Refresh token is required.')
      .max(4096, 'Refresh token is invalid.'),
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
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema))
    request: RefreshTokenRequestDto,
  ): RefreshTokenResponseDto {
    try {
      const tokens = this.tokenService.verifyRefreshToken(request.refreshToken);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresIn: tokens.accessTokenExpiresIn,
      };
    } catch {
      throw new UnauthorizedException(
        'The refresh token is invalid or expired.',
      );
    }
  }
}
