import { z } from 'zod';
import type {
  DeleteStorageObjectResult,
  StoredStorageObject,
} from '../domain/contracts';

export const storageResourceTypeSchema = z.enum(['image', 'video', 'raw']);

export const uploadStorageObjectSchema = z
  .object({
    data: z.instanceof(Buffer).refine((data) => data.length > 0, {
      message: 'File data must not be empty.',
    }),
    resourceType: storageResourceTypeSchema,
    folder: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

export const deleteStorageObjectSchema = z
  .object({
    key: z.string().trim().min(1),
    resourceType: storageResourceTypeSchema,
  })
  .strict();

export type UploadStorageObjectRequestDto = z.infer<
  typeof uploadStorageObjectSchema
>;
export type DeleteStorageObjectRequestDto = z.infer<
  typeof deleteStorageObjectSchema
>;
export type UploadStorageObjectResponseDto = StoredStorageObject;
export type DeleteStorageObjectResponseDto = DeleteStorageObjectResult;
