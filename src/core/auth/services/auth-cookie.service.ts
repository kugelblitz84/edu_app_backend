import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

export const REFRESH_TOKEN_COOKIE = '__Secure-refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';
const CSRF_TOKEN_PATTERN = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/;

@Injectable()
export class AuthCookieService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  setRefreshToken(
    response: Response,
    refreshToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: this.config.auth.cookieSameSite,
      path: REFRESH_COOKIE_PATH,
      maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    });
  }

  clearRefreshToken(response: Response): void {
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: this.config.auth.cookieSameSite,
      path: REFRESH_COOKIE_PATH,
    });
  }

  readRefreshToken(request: Request): string | undefined {
    return this.readCookie(request, REFRESH_TOKEN_COOKIE);
  }

  issueCsrfToken(sessionId: string): string {
    const nonce = randomBytes(32).toString('base64url');
    const signature = this.signCsrfNonce(sessionId, nonce);
    return `${nonce}.${signature}`;
  }

  assertAllowedOrigin(request: Request, requireOrigin = true): void {
    const origin = request.get('origin');
    if (
      (!origin && requireOrigin) ||
      (origin && !this.config.corsOrigins.includes(origin))
    ) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
  }

  assertCsrfToken(request: Request, sessionId: string): void {
    this.assertAllowedOrigin(request);

    const token = request.get('x-csrf-token');
    const match = token?.match(CSRF_TOKEN_PATTERN);
    if (!match) throw new ForbiddenException('A valid CSRF token is required.');

    const [, nonce, signature] = match;
    const suppliedSignature = Buffer.from(signature, 'base64url');
    const expectedSignature = Buffer.from(
      this.signCsrfNonce(sessionId, nonce),
      'base64url',
    );

    if (
      suppliedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      throw new ForbiddenException('A valid CSRF token is required.');
    }
  }

  private signCsrfNonce(sessionId: string, nonce: string): string {
    // Domain-separate the CSRF key from the JWT signing use of the same secret.
    const csrfKey = createHmac('sha256', this.config.auth.accessTokenSecret)
      .update('edu-app-api:csrf-token:v1')
      .digest();
    return createHmac('sha256', csrfKey)
      .update(`session:${sessionId}:nonce:${nonce}`)
      .digest('base64url');
  }

  private readCookie(request: Request, name: string): string | undefined {
    const header = request.headers.cookie;
    if (!header) return undefined;

    let cookieValue: string | undefined;
    let found = false;
    for (const part of header.split(';')) {
      const separator = part.indexOf('=');
      if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
      if (found) return undefined;
      found = true;
      cookieValue = part.slice(separator + 1).trim();
    }

    if (!found || !cookieValue) return undefined;
    try {
      return decodeURIComponent(cookieValue);
    } catch {
      return undefined;
    }
  }
}
