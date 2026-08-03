import { PasswordHasher } from '../contracts/password-hasher.service';
import { RegisterUserRepository } from '../contracts/register-user.repository';
import type { RegisteredUser } from '../entities/registered-user.entity';
import { RegistrationValidationError } from '../errors/registration.error';

export interface RegisterUserInput {
  email?: unknown;
  username?: unknown;
  password?: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export class RegisterUserUseCase {
  constructor(
    private readonly repository: RegisterUserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisteredUser> {
    const normalized = this.normalizeAndValidate(input);
    const passwordHash = await this.passwordHasher.hash(normalized.password);

    return this.repository.createGuestUser({
      email: normalized.email,
      username: normalized.username,
      passwordHash,
      fullName: normalized.username,
    });
  }

  private normalizeAndValidate(input: RegisterUserInput): {
    email: string;
    username: string;
    password: string;
  } {
    const violations: string[] = [];
    const email =
      typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const username =
      typeof input.username === 'string' ? input.username.trim() : '';
    const password = typeof input.password === 'string' ? input.password : '';

    if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
      violations.push('A valid email address is required.');
    }

    if (
      username.length < 3 ||
      username.length > 30 ||
      !USERNAME_PATTERN.test(username)
    ) {
      violations.push(
        'Username must be 3-30 characters and contain only letters, numbers, and underscores.',
      );
    }

    if (password.length < 12 || password.length > 128) {
      violations.push('Password must be 12-128 characters long.');
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
      violations.push('Password must include lowercase and uppercase letters.');
    }

    if (!/[0-9]/.test(password)) {
      violations.push('Password must include at least one number.');
    }

    if (violations.length > 0) {
      throw new RegistrationValidationError(violations);
    }

    return {
      email,
      username,
      password,
    };
  }
}
