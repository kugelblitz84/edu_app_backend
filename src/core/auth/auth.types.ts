import type { Request } from 'express';
import type { PlatformRole, UserStatus } from './domain/identity.types';

export interface AccessTokenSubject {
  userId: string;
  platformRole: PlatformRole;
}

export interface AuthenticatedUser extends AccessTokenSubject {
  sessionId: string;
  issuedAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface SessionUser extends AccessTokenSubject {
  status: UserStatus;
}

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

export interface AccessTokenPayload {
  sub?: unknown;
  sid?: unknown;
  role?: unknown;
  iat?: unknown;
  exp?: unknown;
  iss?: unknown;
  aud?: unknown;
  tokenType?: unknown;
}
