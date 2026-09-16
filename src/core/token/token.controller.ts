import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  PipeTransform,
  Post,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { z } from 'zod';
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

class RefreshTokenRequestValidationPipe implements PipeTransform<
  unknown,
  RefreshTokenRequestDto
> {
  transform(value: unknown): RefreshTokenRequestDto {
    const result = refreshTokenRequestSchema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new UnprocessableEntityException({
      message: 'Refresh token request is invalid.',
      violations: [
        ...new Set(result.error.issues.map((issue) => issue.message)),
      ],
    });
  }
}

@Controller({ path: 'auth', version: '1' })
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new RefreshTokenRequestValidationPipe())
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
