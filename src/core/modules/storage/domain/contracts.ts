import type {
  UploadInput,
  UploadUrlResponse,
  StorageReference,
  StorageObject,
  ReadAccessUrlResponse,
} from './storage.types';

export abstract class StorageProvider {
  abstract createUploadUrl(input: UploadInput): Promise<UploadUrlResponse>;
  /** Use the pending reference saved on the server, never a client-supplied locator.
   * Validate sizeBytes against the pending upload, then persist the verified reference.
   */
  abstract inspect(reference: StorageReference): Promise<StorageObject>;
  /** Accept only the verified reference persisted during upload completion. */
  abstract createReadAccessUrl(
    reference: StorageReference,
  ): Promise<ReadAccessUrlResponse>;
  abstract delete(reference: StorageReference): Promise<void>;
}
