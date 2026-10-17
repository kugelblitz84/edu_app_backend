import { z } from 'zod';
import { StorageError } from '../../domain/storage.errors';
import {
  STORAGE_FILE_TYPES,
  type UploadInput,
  type StorageReference,
} from '../../domain/storage.types';

export const FILE_TYPES = {
  'image/jpeg': { resourceType: 'image', format: 'jpg', folder: 'images' },
  'image/png': { resourceType: 'image', format: 'png', folder: 'images' },
  'image/webp': { resourceType: 'image', format: 'webp', folder: 'images' },
  'video/mp4': { resourceType: 'video', format: 'mp4', folder: 'videos' },
  'application/pdf': {
    resourceType: 'raw',
    format: 'pdf',
    folder: 'materials',
  },
} as const;

export const referenceSchema = z
  .object({
    provider: z.literal('CLOUDINARY'),
    locator: z
      .object({
        key: z.string().min(1),
        resourceType: z.enum(['image', 'video', 'raw']),
        deliveryType: z.literal('authenticated'),
        format: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export const resourceSchema = z.object({
  public_id: z.string(),
  resource_type: z.enum(['image', 'video', 'raw']),
  type: z.literal('authenticated'),
  bytes: z.number().int().positive().safe(),
  format: z.string().min(1).optional(),
});

export type CloudinaryLocator = z.infer<typeof referenceSchema>['locator'];

export function validateReference(
  reference: StorageReference,
): CloudinaryLocator {
  const parsed = referenceSchema.safeParse(reference);
  if (!parsed.success)
    throw new StorageError('INVALID_INPUT', 'Invalid storage reference.');
  const locator = parsed.data.locator;
  const policy = Object.values(FILE_TYPES).find(
    (item) =>
      item.resourceType === locator.resourceType &&
      item.format === locator.format,
  );
  const uuid =
    '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  const suffix = locator.resourceType === 'raw' ? `\\.${locator.format}` : '';
  if (
    !policy ||
    !new RegExp(`^${policy.folder}/${uuid}${suffix}$`).test(locator.key)
  ) {
    throw new StorageError('INVALID_INPUT', 'Invalid storage locator.');
  }
  return locator;
}

export function parseUploadInput(
  input: UploadInput,
  maxUploadBytes: number,
): UploadInput {
  const parsed = z
    .object({
      fileType: z.enum(STORAGE_FILE_TYPES),
      sizeBytes: z.number().int().positive().safe().max(maxUploadBytes),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success)
    throw new StorageError(
      'INVALID_INPUT',
      'Unsupported file type or upload size.',
    );
  return parsed.data;
}

export function parseResource(response: unknown) {
  const parsed = resourceSchema.safeParse(response);
  if (!parsed.success)
    throw new StorageError('INVALID_OBJECT', 'Invalid storage metadata.');
  return parsed.data;
}

const deletionSchema = z.object({ result: z.enum(['ok', 'not found']) });
export function parseDeletion(response: unknown): void {
  if (!deletionSchema.safeParse(response).success) {
    throw new StorageError('UNAVAILABLE', 'Storage provider deletion failed.');
  }
}
