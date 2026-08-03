import type { RegisteredUser } from '../entities/registered-user.entity';

export interface CreateUserRecord {
  email: string;
  username: string;
  passwordHash: string;
  fullName: string;
}

export abstract class RegisterUserRepository {
  abstract createGuestUser(user: CreateUserRecord): Promise<RegisteredUser>;
}
