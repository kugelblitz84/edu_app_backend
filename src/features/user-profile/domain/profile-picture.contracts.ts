import type { StorageReference } from '../../../core/storage/domain/storage.types';

export interface ProfilePictureUpload {
  id: string;
  userId: string;
  fileType: string;
  sizeBytes: number;
  reference: StorageReference;
  expiresAt: Date;
  completedAt: Date | null;
  isCurrent: boolean;
}

export abstract class ProfilePictureRepository {
  abstract savePending(upload: ProfilePictureUpload): Promise<void>;
  abstract findUpload(
    userId: string,
    fileId: string,
  ): Promise<ProfilePictureUpload | null>;
  abstract findCurrent(
    user: { userId: string } | { username: string },
  ): Promise<ProfilePictureUpload | null>;
  /** Serialize changes per user; return the previous picture for cleanup. */
  abstract activate(
    userId: string,
    fileId: string,
    reference: StorageReference,
  ): Promise<ProfilePictureUpload | null>;
}
