import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  APP_CONFIG,
  type AppConfig,
} from '../../../../../core/config/app-config';
import {
  AccessTokenVerifier,
  type VerifiedAccessToken,
} from '../../domain/contracts/access-token-verifier.service';

interface TokenPayload {
  sub?: unknown;
  iat?: unknown;
  exp?: unknown;
  iss?: unknown;
  aud?: unknown;
  tokenType?: unknown;
}

@Injectable()
export class Sha256AccessTokenVerifier implements AccessTokenVerifier {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

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

    const payload = this.decode(encodedPayload) as TokenPayload;
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

  private decode(value: string): unknown {
    return JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as unknown;
  }
}
