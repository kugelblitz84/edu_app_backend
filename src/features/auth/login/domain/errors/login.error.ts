import { DomainError } from '../../../../../core/errors/domain.error';

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid credentials.');
  }
}

export class LoginNotAllowedError extends DomainError {
  constructor() {
    super('Login is not allowed for this account.');
  }
}
