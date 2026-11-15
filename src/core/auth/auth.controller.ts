import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from './decorators/public.decorator';
import { AuthCookieService } from './services/auth-cookie.service';
import {
  InvalidRefreshTokenError,
  SessionService,
} from './services/session.service';
import { RateLimitService } from './services/rate-limit.service';

export interface RefreshTokenResponseDto {
  accessToken: string;
  csrfToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly sessions: SessionService,
    private readonly rateLimits: RateLimitService,
    private readonly authCookies: AuthCookieService,
  ) {}

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.authCookies.assertAllowedOrigin(request);
    const refreshToken = this.authCookies.readRefreshToken(request);

    if (refreshToken) {
      try {
        const sessionId = this.sessions.sessionIdFromRefreshToken(refreshToken);
        this.authCookies.assertCsrfToken(request, sessionId);
        await this.sessions.revokeByRefreshToken(refreshToken);
      } catch (error) {
        if (!(error instanceof InvalidRefreshTokenError)) throw error;
      }
    }

    this.authCookies.clearRefreshToken(response);
    response.setHeader('Cache-Control', 'no-store');
  }

  @Public()
  @Get('csrf')
  @HttpCode(HttpStatus.OK)
  csrf(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): { csrfToken: string } {
    this.authCookies.assertAllowedOrigin(request, false);
    const refreshToken = this.authCookies.readRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException('A valid refresh token is required.');
    }

    try {
      const sessionId = this.sessions.sessionIdFromRefreshToken(refreshToken);
      response.setHeader('Cache-Control', 'no-store');
      return { csrfToken: this.authCookies.issueCsrfToken(sessionId) };
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        this.authCookies.clearRefreshToken(response);
        throw new UnauthorizedException('A valid refresh token is required.');
      }
      throw error;
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshTokenResponseDto> {
    await this.rateLimits.enforce(
      'auth-refresh-ip',
      request.ip ?? 'unknown',
      30,
      15 * 60_000,
      'Too many refresh attempts. Please try again later.',
    );
    this.authCookies.assertAllowedOrigin(request);

    const refreshToken = this.authCookies.readRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException('A valid refresh token is required.');
    }

    try {
      const sessionId = this.sessions.sessionIdFromRefreshToken(refreshToken);
      this.authCookies.assertCsrfToken(request, sessionId);
      const tokens = await this.sessions.rotate(refreshToken, {
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });

      this.authCookies.setRefreshToken(
        response,
        tokens.refreshToken,
        tokens.refreshTokenExpiresAt,
      );
      response.setHeader('Cache-Control', 'no-store');
      return {
        accessToken: tokens.accessToken,
        csrfToken: this.authCookies.issueCsrfToken(sessionId),
        tokenType: 'Bearer',
        expiresIn: tokens.accessTokenExpiresIn,
      };
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        this.authCookies.clearRefreshToken(response);
        throw new UnauthorizedException('A valid refresh token is required.');
      }
      throw error;
    }
  }
}
