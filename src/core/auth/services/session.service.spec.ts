import { createHash } from 'node:crypto';
import type { AppConfig } from '../../config/app-config';
import type { PrismaService } from '../../database/prisma.service';
import { AccessTokenService } from './access-token.service';
import { InvalidRefreshTokenError, SessionService } from './session.service';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  corsOrigins: [],
  databaseUrl: 'postgresql://localhost/test',
  mongodbUrl: 'mongodb://localhost/test',
  auth: {
    accessTokenSecret: 'test-access-token-secret-at-least-32-characters',
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2_592_000,
    issuer: 'edu-app-api',
    passwordResetUrl: 'https://example.com/reset',
    passwordResetTtlSeconds: 3600,
    ipRegionHeader: 'cf-ipcountry',
  },
  mail: { port: 587, secure: false, from: 'test@example.com' },
  passwordHashing: {
    keyLength: 64,
    cost: 16_384,
    blockSize: 8,
    parallelization: 1,
  },
};

const user = {
  userId: '5cae6d1a-930c-45a2-8408-8fb1be8446af',
  platformRole: 'PLATFORM_USER' as const,
  status: 'ACTIVE' as const,
};

describe(SessionService.name, () => {
  const create = jest.fn(
    (args: {
      data: { id: string; refreshTokenDigest: string; userAgent?: string };
      select: { id: boolean };
    }) => {
      void args;
      return Promise.resolve({ id: 'created' });
    },
  );
  const findUnique = jest.fn();
  const updateMany = jest.fn(
    (args: { where: { refreshTokenDigest: string } }) => {
      void args;
      return Promise.resolve({ count: 1 });
    },
  );
  const deleteMany = jest.fn(() => Promise.resolve({ count: 1 }));
  const prisma = {
    authSession: { create, findUnique, updateMany, deleteMany },
  } as unknown as PrismaService;
  const accessTokens = new AccessTokenService(config);
  const sessions = new SessionService(prisma, accessTokens, config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an opaque refresh token and persists only its SHA-256 digest', async () => {
    const result = await sessions.create(user, {
      ipAddress: '127.0.0.1',
      userAgent: 'test-client',
    });
    const data = create.mock.calls[0][0].data;

    expect(result.refreshToken).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i);
    expect(result.refreshToken.startsWith(`${data.id}.`)).toBe(true);
    expect(data.refreshTokenDigest).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex'),
    );
    expect(data.refreshTokenDigest).not.toContain(result.refreshToken);
    expect(data.userAgent).toBe('test-client');
    expect(accessTokens.verify(result.accessToken).userId).toBe(user.userId);
  });

  it('rotates the refresh secret with a compare-and-update and rejects reuse', async () => {
    const original = await sessions.create(user);
    const [sessionId] = original.refreshToken.split('.');
    findUnique.mockResolvedValue({
      id: sessionId,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        id: user.userId,
        platformRole: user.platformRole,
        status: user.status,
      },
    });
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const rotated = await sessions.rotate(original.refreshToken);
    expect(rotated.refreshToken).not.toBe(original.refreshToken);
    expect(rotated.refreshToken.startsWith(`${sessionId}.`)).toBe(true);
    expect(updateMany.mock.calls[0][0].where.refreshTokenDigest).toBe(
      createHash('sha256').update(original.refreshToken).digest('hex'),
    );

    await expect(sessions.rotate(original.refreshToken)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('rejects malformed refresh tokens before querying storage', async () => {
    await expect(sessions.rotate('not-a-refresh-token')).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('deletes every session belonging to a user', async () => {
    await sessions.deleteForUser(user.userId);

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: user.userId } });
  });
});
