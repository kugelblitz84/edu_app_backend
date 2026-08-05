import { DomainError } from '../../../../../core/errors/domain.error';

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid username or password.');
  }
}

export class LoginNotAllowedError extends DomainError {
  constructor() {
    super('This account is not active.');
  }
}
