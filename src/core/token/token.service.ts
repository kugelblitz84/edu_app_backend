import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { PlatformRole } from '../../features/auth/register/domain/entities/registered-user.entity';
import type {
  AccessTokenPayload,
  AccessTokenSubject,
  GeneratedTokenPair,
  JwtPayload,
  RefreshTokenPayload,
  VerifiedAccessToken,
  VerifiedTokenPayload,
} from './token.entities';

@Injectable()
export class TokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  generate(subject: AccessTokenSubject): GeneratedTokenPair {
    const issuedAt = Math.floor(Date.now() / 1000);
    const { auth } = this.config;

    const accessToken = this.sign(
      {
        sub: subject.userId,
        username: subject.username,
        email: subject.email,
        role: subject.platformRole,
        status: subject.status,
        emailVerified: subject.emailVerified,
        tokenType: 'access',
        iss: auth.issuer,
        aud: 'edu-app-api',
        iat: issuedAt,
        exp: issuedAt + auth.accessTokenTtlSeconds,
        jti: randomUUID(),
      },
      auth.accessTokenSecret,
    );

    const refreshToken = this.sign(
      {
        sub: subject.userId,
        username: subject.username,
        email: subject.email,
        role: subject.platformRole,
        status: subject.status,
        emailVerified: subject.emailVerified,
        tokenType: 'refresh',
        iss: auth.issuer,
        aud: 'edu-app-refresh',
        iat: issuedAt,
        exp: issuedAt + auth.refreshTokenTtlSeconds,
        jti: randomUUID(),
      },
      auth.refreshTokenSecret,
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: auth.accessTokenTtlSeconds,
    };
  }

  verify(token: string): VerifiedAccessToken {
    const payload = this.verifyToken(
      token,
      this.config.auth.accessTokenSecret,
      'edu-app-api',
      'access',
    );

    return {
      userId: payload.sub,
      platformRole: this.readPlatformRole(payload.role),
      issuedAt: new Date(payload.iat * 1000),
    };
  }

  verifyRefreshToken(token: string): GeneratedTokenPair {
    const payload = this.verifyToken(
      token,
      this.config.auth.refreshTokenSecret,
      'edu-app-refresh',
      'refresh',
    ) as RefreshTokenPayload;

    if (
      typeof payload.username !== 'string' ||
      typeof payload.email !== 'string' ||
      (payload.role !== 'GUEST' && payload.role !== 'GLOBAL_ADMIN') ||
      (payload.status !== 'ACTIVE' &&
        payload.status !== 'SUSPENDED' &&
        payload.status !== 'BANNED' &&
        payload.status !== 'DELETED') ||
      typeof payload.emailVerified !== 'boolean'
    ) {
      throw new Error('Invalid token');
    }

    return this.generate({
      userId: payload.sub,
      username: payload.username,
      email: payload.email,
      platformRole: payload.role,
      status: payload.status,
      emailVerified: payload.emailVerified,
    });
  }

  private verifyToken(
    token: string,
    secret: string,
    audience: string,
    tokenType: 'access' | 'refresh',
  ): VerifiedTokenPayload {
    if (token.length > 4096) throw new Error('Invalid token');
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token');
    const [encodedHeader, encodedPayload, suppliedSignature] = parts;

    const header = this.decode(encodedHeader) as {
      alg?: unknown;
      typ?: unknown;
    };
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new Error('Invalid token');
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const supplied = Buffer.from(suppliedSignature, 'base64url');
    if (
      supplied.length !== expectedSignature.length ||
      !timingSafeEqual(supplied, expectedSignature)
    ) {
      throw new Error('Invalid token');
    }

    const payload = this.decode(encodedPayload) as AccessTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.iat > now + 60 ||
      payload.exp <= now ||
      payload.iss !== this.config.auth.issuer ||
      payload.aud !== audience ||
      payload.tokenType !== tokenType
    ) {
      throw new Error('Invalid token');
    }

    return payload as VerifiedTokenPayload;
  }

  private sign(payload: JwtPayload, secret: string): string {
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const body = this.encode(payload);
    const signature = createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  private decode(value: string): unknown {
    return JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as unknown;
  }

  private readPlatformRole(value: unknown): PlatformRole {
    if (value === 'GUEST' || value === 'GLOBAL_ADMIN') {
      return value;
    }

    throw new Error('Invalid token');
  }
}
