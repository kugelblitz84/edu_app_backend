export interface PublicUserProfile {
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface OwnUserProfile extends PublicUserProfile {
  id: string;
  email: string;
}

export interface UpdateUserProfile {
  username?: string;
  fullName?: string;
  avatarUrl?: string | null;
}

export class UsernameConflictError extends Error {
  constructor() {
    super('An account with that username already exists.');
    this.name = 'UsernameConflictError';
  }
}

export abstract class UserProfileRepository {
  abstract findById(userId: string): Promise<OwnUserProfile | null>;
  abstract findByUsername(username: string): Promise<PublicUserProfile | null>;
  abstract update(
    userId: string,
    update: UpdateUserProfile,
  ): Promise<OwnUserProfile | null>;
}
