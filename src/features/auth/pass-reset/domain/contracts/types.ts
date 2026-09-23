import type { UserStatus } from '../../../register/domain/entities/registered-user.entity';

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
