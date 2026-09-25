import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import type {
  AccessTokenPayload,
  AccessTokenSubject,
  AuthenticatedUser,
} from '../auth.types';

@Injectable()
export class AccessTokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async generate(
    subject: AccessTokenSubject,
    sessionId: string,
  ): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000);

    return new SignJWT({
      role: subject.platformRole,
      tokenType: 'access',
      sid: sessionId,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(subject.userId)
      .setIssuer(this.config.auth.issuer)
      .setAudience('edu-app-api')
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.config.auth.accessTokenTtlSeconds)
      .setJti(randomUUID())
      .sign(this.signingKey());
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    if (token.length > 4096) throw new Error('Invalid access token');

    const { payload } = await jwtVerify(token, this.signingKey(), {
      algorithms: ['HS256'],
      issuer: this.config.auth.issuer,
      audience: 'edu-app-api',
      typ: 'JWT',
    });
    const claims = payload as AccessTokenPayload;
    const now = Math.floor(Date.now() / 1000);

    if (
      typeof claims.sub !== 'string' ||
      typeof claims.sid !== 'string' ||
      typeof claims.iat !== 'number' ||
      typeof claims.exp !== 'number' ||
      !Number.isSafeInteger(claims.iat) ||
      !Number.isSafeInteger(claims.exp) ||
      claims.iat > now + 60 ||
      claims.tokenType !== 'access' ||
      (claims.role !== 'PLATFORM_USER' && claims.role !== 'GLOBAL_ADMIN')
    ) {
      throw new Error('Invalid access token');
    }

    return {
      userId: claims.sub,
      sessionId: claims.sid,
      platformRole: claims.role,
      issuedAt: new Date(claims.iat * 1000),
    };
  }

  get expiresIn(): number {
    return this.config.auth.accessTokenTtlSeconds;
  }

  private signingKey(): Uint8Array {
    return new TextEncoder().encode(this.config.auth.accessTokenSecret);
  }
}
