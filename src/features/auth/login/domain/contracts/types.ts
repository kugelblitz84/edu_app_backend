import type {
  PlatformRole,
  UserStatus,
} from '../../../../../core/auth/domain/identity.types';

export interface LoginUserRecord {
  id: string;
  email: string;
  username: string;
  fullName: string;
  passwordHash: string;
  platformRole: PlatformRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
}
