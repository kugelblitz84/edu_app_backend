import {
  normalizer,
  RegisterUserInput,
} from '../../domain/contracts/normalizer.service';
import { RegistrationValidationError } from '../../domain/errors/registration.error';
import {
  PASSWORD_LENGTH_MESSAGE,
  passwordMeetsPolicy,
} from '../../../password-policy';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export class NormalizeAndValidateServiceImpl implements normalizer {
  normalizeAndValidate(input: RegisterUserInput): {
    email: string;
    username: string;
    password: string;
  } {
    {
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

      if (!passwordMeetsPolicy(password)) {
        violations.push(PASSWORD_LENGTH_MESSAGE);
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
}
