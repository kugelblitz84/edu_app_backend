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
  interface CreateSessionArgs {
    data: {
      id: string;
      refreshTokenDigest: string;
      refreshTokens: { create: { digest: string } };
      userAgent?: string;
    };
  }

  interface ClaimTokenArgs {
    where: { digest: string; usedAt: null };
    data: { usedAt: Date };
  }

  interface UpdateSessionArgs {
    where: { id: string; refreshTokenDigest?: string };
    data: { revokedAt?: Date; refreshTokenDigest?: string };
  }

  const createSession = jest.fn((args: CreateSessionArgs) => {
    void args;
    return Promise.resolve({ id: 'created' });
  });
  const findRefreshToken = jest.fn();
  const claimRefreshToken = jest.fn((args: ClaimTokenArgs) => {
    void args;
    return Promise.resolve({ count: 1 });
  });
  const createRefreshToken = jest.fn(() => Promise.resolve({ digest: 'next' }));
  const updateSessions = jest.fn((args: UpdateSessionArgs) => {
    void args;
    return Promise.resolve({ count: 1 });
  });
  const findSession = jest.fn();
  const deleteSessions = jest.fn(() => Promise.resolve({ count: 1 }));
  const transactionClient = {
    authRefreshToken: {
      updateMany: claimRefreshToken,
      create: createRefreshToken,
    },
    authSession: { updateMany: updateSessions },
  };
  const runTransaction = jest.fn(
    (callback: (client: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  );
  const prisma = {
    authSession: {
      create: createSession,
      updateMany: updateSessions,
      findFirst: findSession,
      deleteMany: deleteSessions,
    },
    authRefreshToken: { findUnique: findRefreshToken },
    $transaction: runTransaction,
  } as unknown as PrismaService;
  const accessTokens = new AccessTokenService(config);
  const sessions = new SessionService(prisma, accessTokens, config);

  beforeEach(() => {
    jest.clearAllMocks();
    claimRefreshToken.mockResolvedValue({ count: 1 });
    updateSessions.mockResolvedValue({ count: 1 });
  });

  it('creates an opaque refresh token, its history, and a session-bound access token', async () => {
    const result = await sessions.create(user, {
      ipAddress: '127.0.0.1',
      userAgent: 'test-client',
    });
    const data = createSession.mock.calls[0][0].data;
    const digest = createHash('sha256')
      .update(result.refreshToken)
      .digest('hex');

    expect(result.refreshToken).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i);
    expect(result.refreshToken.startsWith(`${data.id}.`)).toBe(true);
    expect(data.refreshTokenDigest).toBe(digest);
    expect(data.refreshTokens).toEqual({ create: { digest } });
    expect(data.userAgent).toBe('test-client');

    const claims = await accessTokens.verify(result.accessToken);
    expect(claims).toMatchObject({ userId: user.userId, sessionId: data.id });
  });

  it('rotates once and revokes the token family when an old token is replayed', async () => {
    const original = await sessions.create(user);
    const [sessionId] = original.refreshToken.split('.');
    const currentDigest = createHash('sha256')
      .update(original.refreshToken)
      .digest('hex');
    const stored = {
      usedAt: null as Date | null,
      session: {
        id: sessionId,
        refreshTokenDigest: currentDigest,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        user: {
          id: user.userId,
          platformRole: user.platformRole,
          status: user.status,
        },
      },
    };
    findRefreshToken.mockImplementation(() => Promise.resolve(stored));

    const rotated = await sessions.rotate(original.refreshToken);
    expect(rotated.refreshToken).not.toBe(original.refreshToken);
    expect(rotated.refreshToken.startsWith(`${sessionId}.`)).toBe(true);
    const claim = claimRefreshToken.mock.calls[0][0];
    expect(claim.where).toEqual({ digest: currentDigest, usedAt: null });
    expect(claim.data.usedAt).toBeInstanceOf(Date);

    stored.usedAt = new Date();
    await expect(sessions.rotate(original.refreshToken)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    const revocation = updateSessions.mock.lastCall?.[0];
    expect(revocation?.where).toEqual({ id: sessionId });
    expect(revocation?.data.revokedAt).toBeInstanceOf(Date);
  });

  it('rejects malformed refresh tokens before querying storage', async () => {
    await expect(sessions.rotate('not-a-refresh-token')).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(findRefreshToken).not.toHaveBeenCalled();
  });

  it('uses current database role and status for access authentication', async () => {
    findSession.mockResolvedValue({ user: { platformRole: 'GLOBAL_ADMIN' } });
    const issuedAt = new Date();
    await expect(
      sessions.authenticateAccessToken({
        userId: user.userId,
        sessionId: 'session-id',
        platformRole: 'PLATFORM_USER',
        issuedAt,
      }),
    ).resolves.toEqual({
      userId: user.userId,
      sessionId: 'session-id',
      platformRole: 'GLOBAL_ADMIN',
      issuedAt,
    });
  });

  it('deletes every session belonging to a user', async () => {
    await sessions.deleteForUser(user.userId);
    expect(deleteSessions).toHaveBeenCalledWith({
      where: { userId: user.userId },
    });
  });
});
