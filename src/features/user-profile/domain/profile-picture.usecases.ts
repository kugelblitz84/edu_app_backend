import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageProvider } from '../../../core/modules/storage/domain/contracts';
import { StorageError } from '../../../core/modules/storage/domain/storage.errors';
import type {
  UploadInput,
  UploadUrlResponse,
} from '../../../core/modules/storage/domain/storage.types';
import { ProfilePictureRepository } from './profile-picture.contracts';

export const PROFILE_PICTURE_MAX_BYTES = 5 * 1024 * 1024;

function translateStorageError(error: unknown): never {
  if (!(error instanceof StorageError)) throw error;
  if (error.code === 'NOT_FOUND')
    throw new NotFoundException('Uploaded profile picture not found.');
  if (error.code === 'INVALID_INPUT' || error.code === 'INVALID_OBJECT')
    throw new BadRequestException('Invalid profile picture upload.');
  if (error.code === 'RATE_LIMITED')
    throw new HttpException(
      'Storage rate limit reached. Please retry later.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  throw new ServiceUnavailableException(
    'Profile picture storage is unavailable.',
  );
}

@Injectable()
export class ProfilePictureUseCases {
  private readonly logger = new Logger(ProfilePictureUseCases.name);
  constructor(
    private readonly repository: ProfilePictureRepository,
    private readonly storage: StorageProvider,
  ) {}

  async createUpload(
    userId: string,
    input: UploadInput,
  ): Promise<UploadUrlResponse> {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(input.fileType) ||
      !Number.isSafeInteger(input.sizeBytes) ||
      input.sizeBytes < 1 ||
      input.sizeBytes > PROFILE_PICTURE_MAX_BYTES
    ) {
      throw new BadRequestException(
        'Profile pictures must be JPEG, PNG or WebP and at most 5 MiB.',
      );
    }
    try {
      const upload = await this.storage.createUploadUrl(input);
      await this.repository.savePending({
        id: upload.fileId,
        userId,
        fileType: input.fileType,
        sizeBytes: input.sizeBytes,
        reference: upload.reference,
        expiresAt: new Date(upload.expiresAt * 1000),
        completedAt: null,
        isCurrent: false,
      });
      return upload;
    } catch (error) {
      translateStorageError(error);
    }
  }

  async completeUpload(userId: string, fileId: string): Promise<void> {
    const upload = await this.repository.findUpload(userId, fileId);
    if (!upload)
      throw new NotFoundException('Profile picture upload not found.');
    if (upload.completedAt) {
      if (upload.isCurrent) return;
      throw new ConflictException(
        'This profile picture has already been replaced.',
      );
    }
    if (upload.expiresAt <= new Date())
      throw new ConflictException('Profile picture upload expired.');
    try {
      const verified = await this.storage.inspect(upload.reference);
      if (
        verified.sizeBytes !== upload.sizeBytes ||
        verified.sizeBytes > PROFILE_PICTURE_MAX_BYTES ||
        !Number.isSafeInteger(verified.sizeBytes) ||
        verified.sizeBytes < 1
      ) {
        throw new BadRequestException(
          'Uploaded picture size does not match the requested upload.',
        );
      }
      const previous = await this.repository.activate(
        userId,
        fileId,
        verified.reference,
      );
      if (previous) {
        try {
          await this.storage.delete(previous.reference);
        } catch {
          this.logger.warn(
            `Could not remove replaced profile picture ${previous.id}.`,
          );
        }
      }
    } catch (error) {
      translateStorageError(error);
    }
  }

  async resolveAvatarUrl(
    user: { userId: string } | { username: string },
    fallback: string | null,
  ): Promise<string | null> {
    const upload = await this.repository.findCurrent(user);
    if (!upload) return fallback;
    try {
      return (await this.storage.createReadAccessUrl(upload.reference)).url;
    } catch (error) {
      translateStorageError(error);
    }
  }
}
