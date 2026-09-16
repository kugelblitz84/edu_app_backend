import type { AppConfig } from '../config/app-config';
import { TokenService } from './token.service';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  corsOrigins: [],
  databaseUrl: 'postgres://test',
  auth: {
    accessTokenSecret: 'access-secret-that-is-at-least-32-characters',
    refreshTokenSecret: 'refresh-secret-that-is-at-least-32-characters',
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2_592_000,
    issuer: 'edu-app-api',
    passwordResetUrl: 'https://example.com/reset-password',
    passwordResetTtlSeconds: 3600,
    ipRegionHeader: 'cf-ipcountry',
  },
  mail: {
    port: 587,
    secure: false,
    from: 'no-reply@example.com',
  },
  passwordHashing: {
    keyLength: 64,
    cost: 16_384,
    blockSize: 8,
    parallelization: 1,
  },
};

const subject = {
  userId: 'user-id',
  username: 'learner',
  email: 'learner@example.com',
  platformRole: 'GUEST' as const,
  status: 'ACTIVE' as const,
  emailVerified: true,
};

describe('TokenService', () => {
  const service = new TokenService(config);

  it('verifies a refresh token and rotates it into a new token pair', () => {
    const original = service.generate(subject);

    const rotated = service.verifyRefreshToken(original.refreshToken);

    expect(typeof rotated.accessToken).toBe('string');
    expect(typeof rotated.refreshToken).toBe('string');
    expect(rotated.accessTokenExpiresIn).toBe(
      config.auth.accessTokenTtlSeconds,
    );
    expect(rotated.accessToken).not.toBe(original.accessToken);
    expect(rotated.refreshToken).not.toBe(original.refreshToken);
    expect(service.verify(rotated.accessToken).userId).toBe(subject.userId);
  });

  it('rejects an access token when a refresh token is required', () => {
    const tokens = service.generate(subject);

    expect(() => service.verifyRefreshToken(tokens.accessToken)).toThrow(
      'Invalid token',
    );
  });

  it('rejects a refresh token with a modified signature', () => {
    const tokens = service.generate(subject);
    const parts = tokens.refreshToken.split('.');
    const signature = parts[2];
    parts[2] = `${signature.slice(0, -1)}${
      signature.endsWith('a') ? 'b' : 'a'
    }`;

    expect(() => service.verifyRefreshToken(parts.join('.'))).toThrow(
      'Invalid token',
    );
  });
});
