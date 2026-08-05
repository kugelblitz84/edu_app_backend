import type {
  PlatformRole,
  UserStatus,
} from '../../../register/domain/entities/registered-user.entity';

export interface AccessTokenSubject {
  userId: string;
  username: string;
  email: string;
  platformRole: PlatformRole;
  status: UserStatus;
  emailVerified: boolean;
}

export interface GeneratedTokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

export abstract class TokenGenerator {
  abstract generate(subject: AccessTokenSubject): GeneratedTokenPair;
}
