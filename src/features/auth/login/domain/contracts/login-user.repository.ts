import type { LoginUserRecord } from './types';

export abstract class LoginUserRepository {
  abstract findByUsername(username: string): Promise<LoginUserRecord | null>;
  abstract recordSuccessfulLogin(
    userId: string,
    loggedInAt: Date,
    ipAddress?: string,
    ipRegion?: string,
  ): Promise<void>;
}
