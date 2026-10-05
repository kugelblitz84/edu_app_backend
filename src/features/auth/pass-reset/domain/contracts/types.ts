import type { UserStatus } from '../../../../../core/auth/domain/identity.types';

export interface PasswordResetUser {
  id: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  lastLoginIp: string | null;
  lastLoginRegion: string | null;
  passwordChangedAt: Date | null;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  consumedAt: Date | null;
}
