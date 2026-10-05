import type { PlatformRole } from '../../../../../core/auth/domain/identity.types';

export interface LoggedInUser {
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    platformRole: PlatformRole;
  };
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
