export abstract class InstitutionCodeGenerator {
  abstract generate(): string;
}

export class InstitutionCodeConflictError extends Error {
  constructor() {
    super('Institution code already exists.');
  }
}
