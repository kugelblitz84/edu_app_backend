import type { PlatformRole } from '../../../register/domain/entities/registered-user.entity';

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
