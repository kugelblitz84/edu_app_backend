import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { PrismaService } from '../../database/prisma.service';
import type {
  AuthenticatedUser,
  AuthTokenPair,
  SessionMetadata,
  SessionUser,
} from '../auth.types';
import { AccessTokenService } from './access-token.service';

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('The refresh token is invalid or expired.');
  }
}

interface CachedSession {
  userId: string;
  platformRole: SessionUser['platformRole'];
  expiresAt: number;
}

const MAX_CACHED_SESSIONS = 10_000;

@Injectable()
export class SessionService {
  private readonly sessionCache = new Map<string, CachedSession>();
  private cacheEpoch = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokens: AccessTokenService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async create(
    user: SessionUser,
    metadata: SessionMetadata = {},
  ): Promise<AuthTokenPair> {
    const sessionId = randomUUID();
    const refreshToken = this.generateRefreshToken(sessionId);
    const refreshTokenDigest = this.digest(refreshToken);

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.userId,
        refreshTokenDigest,
        refreshTokens: { create: { digest: refreshTokenDigest } },
        expiresAt: new Date(
          Date.now() + this.config.auth.refreshTokenTtlSeconds * 1000,
        ),
        ipAddress: this.ipAddress(metadata.ipAddress),
        userAgent: this.userAgent(metadata.userAgent),
      },
      select: { id: true },
    });

    return this.tokensFor(user, sessionId, refreshToken);
  }

  async rotate(
    refreshToken: string,
    metadata: SessionMetadata = {},
  ): Promise<AuthTokenPair> {
    const sessionId = this.readSessionId(refreshToken);
    const currentDigest = this.digest(refreshToken);
    const token = await this.prisma.authRefreshToken.findUnique({
      where: { digest: currentDigest },
      select: {
        usedAt: true,
        session: {
          select: {
            id: true,
            refreshTokenDigest: true,
            expiresAt: true,
            revokedAt: true,
            user: {
              select: { id: true, platformRole: true, status: true },
            },
          },
        },
      },
    });
    const now = new Date();

    if (!token || token.session.id !== sessionId) {
      throw new InvalidRefreshTokenError();
    }

    if (token.usedAt !== null) {
      await this.revoke(sessionId);
      throw new InvalidRefreshTokenError();
    }

    const session = token.session;
    if (
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.user.status !== 'ACTIVE'
    ) {
      this.invalidateSession(session.id);
      throw new InvalidRefreshTokenError();
    }

    const nextRefreshToken = this.generateRefreshToken(session.id);
    const nextDigest = this.digest(nextRefreshToken);
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.authRefreshToken.updateMany({
        where: { digest: currentDigest, usedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return false;

      const updated = await transaction.authSession.updateMany({
        where: {
          id: session.id,
          refreshTokenDigest: currentDigest,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          refreshTokenDigest: nextDigest,
          rotatedAt: now,
          lastSeenAt: now,
          ipAddress: this.ipAddress(metadata.ipAddress),
          userAgent: this.userAgent(metadata.userAgent),
        },
      });
      if (updated.count !== 1) return false;

      await transaction.authRefreshToken.create({
        data: { digest: nextDigest, sessionId: session.id },
        select: { digest: true },
      });
      return true;
    });

    if (!rotated) {
      await this.revoke(session.id);
      throw new InvalidRefreshTokenError();
    }

    this.invalidateSession(session.id);
    return this.tokensFor(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        status: session.user.status,
      },
      session.id,
      nextRefreshToken,
    );
  }

  async authenticateAccessToken(
    claims: AuthenticatedUser,
  ): Promise<AuthenticatedUser | null> {
    const cached = this.sessionCache.get(claims.sessionId);
    const now = Date.now();
    if (cached) {
      if (cached.userId === claims.userId && cached.expiresAt > now) {
        return { ...claims, platformRole: cached.platformRole };
      }
      this.sessionCache.delete(claims.sessionId);
    }

    const cacheEpoch = this.cacheEpoch;
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: claims.sessionId,
        userId: claims.userId,
        revokedAt: null,
        expiresAt: { gt: new Date(now) },
        user: { status: 'ACTIVE' },
      },
      select: {
        expiresAt: true,
        user: { select: { platformRole: true } },
      },
    });

    if (!session) return null;
    if (cacheEpoch === this.cacheEpoch) {
      this.cacheSession(claims.sessionId, {
        userId: claims.userId,
        platformRole: session.user.platformRole,
        expiresAt: Math.min(
          session.expiresAt.getTime(),
          now + this.config.auth.accessTokenTtlSeconds * 1000,
        ),
      });
    }
    return { ...claims, platformRole: session.user.platformRole };
  }

  async revoke(sessionId: string, userId?: string): Promise<void> {
    const revoked = await this.prisma.authSession.updateMany({
      where: { id: sessionId, ...(userId ? { userId } : {}) },
      data: { revokedAt: new Date() },
    });
    if (revoked.count > 0) this.invalidateSession(sessionId);
  }

  /**
   * Call after changing a user's status or platform role so no session can
   * continue with authorization data issued before the change.
   */
  async revokeForUser(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.invalidateUserSessions(userId);
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { userId } });
    this.invalidateUserSessions(userId);
  }

  private cacheSession(sessionId: string, session: CachedSession): void {
    this.sessionCache.delete(sessionId);
    if (this.sessionCache.size >= MAX_CACHED_SESSIONS) {
      const oldestSessionId = this.sessionCache.keys().next().value as
        string | undefined;
      if (oldestSessionId) this.sessionCache.delete(oldestSessionId);
    }
    this.sessionCache.set(sessionId, session);
  }

  private invalidateSession(sessionId: string): void {
    this.cacheEpoch += 1;
    this.sessionCache.delete(sessionId);
  }

  private invalidateUserSessions(userId: string): void {
    this.cacheEpoch += 1;
    for (const [sessionId, session] of this.sessionCache) {
      if (session.userId === userId) this.sessionCache.delete(sessionId);
    }
  }

  private async tokensFor(
    user: SessionUser,
    sessionId: string,
    refreshToken: string,
  ): Promise<AuthTokenPair> {
    return {
      accessToken: await this.accessTokens.generate(user, sessionId),
      refreshToken,
      accessTokenExpiresIn: this.accessTokens.expiresIn,
    };
  }

  private generateRefreshToken(sessionId: string): string {
    return `${sessionId}.${randomBytes(32).toString('base64url')}`;
  }

  private readSessionId(token: string): string {
    const match = token.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i,
    );
    if (!match) throw new InvalidRefreshTokenError();
    return match[1];
  }

  private digest(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private ipAddress(value?: string): string | undefined {
    return value?.trim().slice(0, 45) || undefined;
  }

  private userAgent(value?: string): string | undefined {
    return value?.trim().slice(0, 512) || undefined;
  }
}
