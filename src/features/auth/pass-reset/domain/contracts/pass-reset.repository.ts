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

export abstract class PassResetRepository {
  abstract findUserByEmail(email: string): Promise<PasswordResetUser | null>;
  abstract findUserById(userId: string): Promise<PasswordResetUser | null>;
  abstract replaceActiveReset(
    userId: string,
    tokenDigest: string,
    expiresAt: Date,
  ): Promise<void>;
  abstract findResetByDigest(
    tokenDigest: string,
  ): Promise<PasswordResetRecord | null>;
  abstract consumeResetAndChangePassword(
    resetId: string,
    userId: string,
    passwordHash: string,
    changedAt: Date,
  ): Promise<boolean>;
  abstract changePassword(
    userId: string,
    passwordHash: string,
    changedAt: Date,
  ): Promise<void>;
}
