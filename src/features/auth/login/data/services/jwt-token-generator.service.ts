import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import {
  APP_CONFIG,
  type AppConfig,
} from '../../../../../core/config/app-config';
import {
  type AccessTokenSubject,
  type GeneratedTokenPair,
  TokenGenerator,
} from '../../domain/contracts/token-generator.service';

interface JwtPayload {
  [claim: string]: boolean | number | string;
}

@Injectable()
export class JwtTokenGenerator implements TokenGenerator {
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
}
