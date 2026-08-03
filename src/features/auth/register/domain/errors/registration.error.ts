import { DomainError } from '../../../../../core/errors/domain.error';

export class RegistrationValidationError extends DomainError {
  constructor(public readonly violations: string[]) {
    super('Registration request is invalid.');
  }
}

export type RegistrationConflictType = 'email' | 'username' | 'unknown';

export class RegistrationConflictError extends DomainError {
  private constructor(
    public readonly conflictType: RegistrationConflictType,
    message: string,
  ) {
    super(message);
  }

  static email(): RegistrationConflictError {
    return new RegistrationConflictError(
      'email',
      'An account with that email already exists.',
    );
  }

  static username(): RegistrationConflictError {
    return new RegistrationConflictError(
      'username',
      'An account with that username already exists.',
    );
  }

  static unknown(): RegistrationConflictError {
    return new RegistrationConflictError(
      'unknown',
      'Unknown error occured while registering user. Please try again later.',
    );
  }
}
