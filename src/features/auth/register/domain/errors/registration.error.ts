import { DomainError } from '../../../../../core/errors/domain.error';

export class RegistrationValidationError extends DomainError {
  constructor(public readonly violations: string[]) {
    super('Registration request is invalid.');
  }
}

export class RegistrationConflictError extends DomainError {
  constructor() {
    super('An account with that email or username already exists.');
  }
}
