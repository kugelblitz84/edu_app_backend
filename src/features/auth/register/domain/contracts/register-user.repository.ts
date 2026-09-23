import type { RegisteredUser } from '../entities/registered-user.entity';
import type { CreateUserRecord } from './types';

export abstract class RegisterUserRepository {
  abstract createGuestUser(user: CreateUserRecord): Promise<RegisteredUser>;
}
