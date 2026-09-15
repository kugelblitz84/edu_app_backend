import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  PlatformRole,
  UserStatus,
} from '../../features/auth/register/domain/entities/registered-user.entity';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

export interface AccessTokenSubject {
  userId: string;
  username: string;
  email: string;
  platformRole: PlatformRole;
  status: UserStatus;
  emailVerified: boolean;
}

export interface GeneratedTokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

export interface VerifiedAccessToken {
  userId: string;
  issuedAt: Date;
}

interface JwtPayload {
  [claim: string]: boolean | number | string;
}

interface AccessTokenPayload {
  sub?: unknown;
  iat?: unknown;
  exp?: unknown;
  iss?: unknown;
  aud?: unknown;
  tokenType?: unknown;
}

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

    const expectedSignature = createHmac(
      'sha256',
      this.config.auth.accessTokenSecret,
    )
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
      payload.aud !== 'edu-app-api' ||
      payload.tokenType !== 'access'
    ) {
      throw new Error('Invalid token');
    }

    return {
      userId: payload.sub,
      issuedAt: new Date(payload.iat * 1000),
    };
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
}
