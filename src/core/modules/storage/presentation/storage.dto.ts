import { z } from 'zod';
import {
  STORAGE_FILE_TYPES,
  type UploadInput,
  type UploadUrlResponse,
} from '../domain/storage.types';

export const uploadInputSchema = z
  .object({
    fileType: z.enum(STORAGE_FILE_TYPES),
    sizeBytes: z.number().int().positive().safe(),
  })
  .strict();

export type UploadInputDto = z.infer<typeof uploadInputSchema>;
export const storageFileRequestSchema = z.object({ fileId: z.uuid() }).strict();
export type StorageFileRequestDto = z.infer<typeof storageFileRequestSchema>;
export type UploadUrlResponseDto = Omit<UploadUrlResponse, 'reference'>;

export function toUploadInput(dto: UploadInputDto): UploadInput {
  return uploadInputSchema.parse(dto);
}

export function toUploadUrlResponseDto(
  result: UploadUrlResponse,
): UploadUrlResponseDto {
  return {
    fileId: result.fileId,
    url: result.url,
    method: result.method,
    fields: result.fields,
    expiresAt: result.expiresAt,
  };
}
