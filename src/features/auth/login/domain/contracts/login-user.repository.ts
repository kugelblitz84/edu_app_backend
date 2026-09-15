import type {
  PlatformRole,
  UserStatus,
} from '../../../register/domain/entities/registered-user.entity';

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

export abstract class LoginUserRepository {
  abstract findByUsername(username: string): Promise<LoginUserRecord | null>;
  abstract recordSuccessfulLogin(
    userId: string,
    loggedInAt: Date,
    ipAddress?: string,
    ipRegion?: string,
  ): Promise<void>;
}
