import { DomainError } from '../../../../../core/errors/domain.error';

export class InvalidResetTokenError extends DomainError {
  constructor() {
    super('The password reset token is invalid or expired.');
  }
}

export class InvalidCurrentPasswordError extends DomainError {
  constructor() {
    super('The current password is incorrect.');
  }
}

export class InvalidAccessTokenError extends DomainError {
  constructor() {
    super('A valid access token is required.');
  }
}
