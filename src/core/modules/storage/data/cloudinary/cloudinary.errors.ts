import { z } from 'zod';
import { StorageError } from '../../domain/storage.errors';

const providerErrorSchema = z.object({
  http_code: z.number().optional(),
  statusCode: z.number().optional(),
});

export function providerError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const parsed = providerErrorSchema.safeParse(error);
  const status = parsed.success
    ? (parsed.data.http_code ?? parsed.data.statusCode)
    : undefined;
  const code =
    status === 404
      ? 'NOT_FOUND'
      : status === 401 || status === 403
        ? 'FORBIDDEN'
        : status === 420 || status === 429
          ? 'RATE_LIMITED'
          : status === 400
            ? 'INVALID_INPUT'
            : 'UNAVAILABLE';
  return new StorageError(code, 'Storage provider operation failed.', {
    cause: error,
  });
}
