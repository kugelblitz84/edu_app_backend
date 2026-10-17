export type StorageResourceType = 'image' | 'video' | 'raw';

export interface UploadStorageObject {
  data: Buffer;
  resourceType: StorageResourceType;
  /** Optional namespace within the provider. */
  folder?: string;
}

export interface StorageObjectReference {
  /** Opaque provider key. Persist this together with resourceType for deletion. */
  key: string;
  resourceType: StorageResourceType;
}

export interface StoredStorageObject extends StorageObjectReference {
  url: string;
  sizeBytes: number;
  format?: string;
}

export interface DeleteStorageObjectResult {
  deleted: boolean;
}

/** Inject this contract; provider selection belongs in StorageProviderModule. */
export abstract class StorageProviderService {
  abstract upload(input: UploadStorageObject): Promise<StoredStorageObject>;
  /** Missing objects return deleted: false, allowing safe retries. */
  abstract delete(
    input: StorageObjectReference,
  ): Promise<DeleteStorageObjectResult>;
}
