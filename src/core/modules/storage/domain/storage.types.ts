/** Shared application types; provider locators never serve as frontend file IDs. */
export const STORAGE_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf',
] as const;
export type StorageFileType = (typeof STORAGE_FILE_TYPES)[number];

export interface UploadInput {
  fileType: StorageFileType;
  sizeBytes: number;
}

/** Server-only: persist with the application's file record. */
export interface StorageReference {
  provider: string;
  /** Opaque provider metadata. Only the owning adapter interprets it. */
  locator: Readonly<Record<string, unknown>>;
}

export interface UploadUrlResponse {
  fileId: string;
  url: string;
  method: 'POST';
  fields: Record<string, string>;
  /** Server-only; presentation must omit this value. */
  reference: StorageReference;
  expiresAt: number;
}

export interface StorageObject {
  /** Persist this verified reference during upload completion. */
  reference: StorageReference;
  sizeBytes: number;
}

export interface ReadAccessUrlResponse {
  url: string;
  expiresAt: number;
}
