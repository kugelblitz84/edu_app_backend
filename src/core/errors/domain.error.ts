/**
 * Base error for expected business-rule failures.
 * Feature-specific domain errors can extend this class later.
 */
export abstract class DomainError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
