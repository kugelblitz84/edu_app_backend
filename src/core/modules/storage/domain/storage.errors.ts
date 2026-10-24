export type StorageErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'INVALID_OBJECT';

export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'StorageError';
  }
}
