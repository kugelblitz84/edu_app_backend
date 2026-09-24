import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import type {
  AccessTokenPayload,
  AccessTokenSubject,
  AuthenticatedUser,
} from '../auth.types';

@Injectable()
export class AccessTokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  generate(subject: AccessTokenSubject): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = {
      sub: subject.userId,
      role: subject.platformRole,
      tokenType: 'access',
      iss: this.config.auth.issuer,
      aud: 'edu-app-api',
      iat: issuedAt,
      exp: issuedAt + this.config.auth.accessTokenTtlSeconds,
      jti: randomUUID(),
    };
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const body = this.encode(payload);
    const signature = createHmac('sha256', this.config.auth.accessTokenSecret)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  verify(token: string): AuthenticatedUser {
    if (token.length > 4096) throw new Error('Invalid access token');
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid access token');
    const [encodedHeader, encodedPayload, suppliedSignature] = parts;
    const header = this.decode(encodedHeader) as {
      alg?: unknown;
      typ?: unknown;
    };

    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new Error('Invalid access token');
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
      throw new Error('Invalid access token');
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
      payload.tokenType !== 'access' ||
      (payload.role !== 'PLATFORM_USER' && payload.role !== 'GLOBAL_ADMIN')
    ) {
      throw new Error('Invalid access token');
    }

    return {
      userId: payload.sub,
      platformRole: payload.role,
      issuedAt: new Date(payload.iat * 1000),
    };
  }

  get expiresIn(): number {
    return this.config.auth.accessTokenTtlSeconds;
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
