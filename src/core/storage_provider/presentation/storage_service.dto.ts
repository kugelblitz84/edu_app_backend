import { z } from 'zod';

export const storageResourceTypeSchema = z.enum(['image', 'video', 'raw']);

export const uploadInputSchema = z
  .object({
    resourceType: storageResourceTypeSchema,
    folder: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

export const storageReferenceSchema = z
  .object({
    key: z.string().trim().min(1),
    resourceType: storageResourceTypeSchema,
  })
  .strict();

export type UploadInputDto = z.infer<typeof uploadInputSchema>;
export type StorageReferenceDto = z.infer<typeof storageReferenceSchema>;

export interface UploadUrlResponseDto {
  url: string;
  method: 'POST';
  /** Send these fields together with the file in a multipart/form-data request. */
  fields: Record<string, string>;
  reference: StorageReferenceDto;
  /** Cloudinary upload signatures are valid for one hour from their timestamp. */
  expiresAt: number;
}

export interface StorageObject {
  reference: StorageReferenceDto;
  sizeBytes: number;
  format?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface ReadAccessUrlResponseDto {
  url: string;
  /** Unix timestamp in seconds. */
  expiresAt: number;
}
