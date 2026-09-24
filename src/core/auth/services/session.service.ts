import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { PrismaService } from '../../database/prisma.service';
import type {
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

@Injectable()
export class SessionService {
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
    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.userId,
        refreshTokenDigest: this.digest(refreshToken),
        expiresAt: new Date(
          Date.now() + this.config.auth.refreshTokenTtlSeconds * 1000,
        ),
        ipAddress: this.ipAddress(metadata.ipAddress),
        userAgent: this.userAgent(metadata.userAgent),
      },
      select: { id: true },
    });

    return this.tokensFor(user, refreshToken);
  }

  async rotate(
    refreshToken: string,
    metadata: SessionMetadata = {},
  ): Promise<AuthTokenPair> {
    const sessionId = this.readSessionId(refreshToken);
    const currentDigest = this.digest(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenDigest: currentDigest },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: { id: true, platformRole: true, status: true },
        },
      },
    });
    const now = new Date();

    if (
      !session ||
      session.id !== sessionId ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new InvalidRefreshTokenError();
    }

    const nextRefreshToken = this.generateRefreshToken(session.id);
    const rotation = await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        refreshTokenDigest: currentDigest,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        refreshTokenDigest: this.digest(nextRefreshToken),
        rotatedAt: now,
        lastSeenAt: now,
        ipAddress: this.ipAddress(metadata.ipAddress),
        userAgent: this.userAgent(metadata.userAgent),
      },
    });

    if (rotation.count !== 1) throw new InvalidRefreshTokenError();

    return this.tokensFor(
      {
        userId: session.user.id,
        platformRole: session.user.platformRole,
        status: session.user.status,
      },
      nextRefreshToken,
    );
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { userId } });
  }

  private tokensFor(user: SessionUser, refreshToken: string): AuthTokenPair {
    return {
      accessToken: this.accessTokens.generate(user),
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
