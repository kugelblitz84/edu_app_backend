import type {
  PlatformRole,
  UserStatus,
} from '../../../../../core/auth/domain/identity.types';

export type {
  PlatformRole,
  UserStatus,
} from '../../../../../core/auth/domain/identity.types';

export interface RegisteredUser {
  id: string;
  email: string;
  username: string;
  platformRole: PlatformRole;
  status: UserStatus;
  createdAt: Date;
}
