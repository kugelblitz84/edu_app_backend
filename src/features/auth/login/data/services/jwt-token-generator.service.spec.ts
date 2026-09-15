import type { AppConfig } from '../../../../../core/config/app-config';
import { JwtTokenGenerator } from './jwt-token-generator.service';

function decodePayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  return JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as Record<string, unknown>;
}

describe(JwtTokenGenerator.name, () => {
  it('puts identity/authorization claims only in the access token', () => {
    const config: AppConfig = {
      nodeEnv: 'test',
      port: 3000,
      corsOrigins: [],
      databaseUrl: 'postgres://unused',
      auth: {
        accessTokenSecret: 'a'.repeat(32),
        refreshTokenSecret: 'b'.repeat(32),
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
        cost: 131_072,
        blockSize: 8,
        parallelization: 1,
      },
    };
    const tokens = new JwtTokenGenerator(config).generate({
      userId: 'user-id',
      username: 'learner_01',
      email: 'learner@example.com',
      platformRole: 'GUEST',
      status: 'ACTIVE',
      emailVerified: true,
    });

    expect(decodePayload(tokens.accessToken)).toMatchObject({
      sub: 'user-id',
      username: 'learner_01',
      email: 'learner@example.com',
      role: 'GUEST',
      status: 'ACTIVE',
      emailVerified: true,
      tokenType: 'access',
      aud: 'edu-app-api',
    });
    expect(decodePayload(tokens.refreshToken)).toMatchObject({
      sub: 'user-id',
      tokenType: 'refresh',
      aud: 'edu-app-refresh',
    });
    expect(decodePayload(tokens.refreshToken)).not.toHaveProperty('username');
    expect(tokens.accessToken).not.toBe(tokens.refreshToken);
  });
});
