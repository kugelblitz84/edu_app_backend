import { providerError } from './cloudinary.errors';
import {
  FILE_TYPES,
  validateReference,
  parseUploadInput,
  parseResource,
  parseDeletion,
} from './cloudinary.schemas';
import { StorageError } from '../../domain/storage.errors';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider } from '../../domain/contracts';
import {
  type UploadInput,
  type UploadUrlResponse,
  type StorageReference,
  type StorageObject,
  type ReadAccessUrlResponse,
} from '../../domain/storage.types';
import {
  CLOUDINARY_CONFIG,
  type CloudinaryConfig,
} from '../../config/cloudinary.config';

@Injectable()
export class CloudinaryStorageProviderService implements StorageProvider {
  constructor(
    @Inject(CLOUDINARY_CONFIG) private readonly config: CloudinaryConfig,
  ) {}

  private get credentials() {
    return {
      cloud_name: this.config.cloudName,
      api_key: this.config.apiKey,
      api_secret: this.config.apiSecret,
      secure: true,
    };
  }

  // Preserve rejected promises for validation/signing failures at the async contract boundary.
  // eslint-disable-next-line @typescript-eslint/require-await
  async createUploadUrl(input: UploadInput): Promise<UploadUrlResponse> {
    const parsed = parseUploadInput(input, this.config.maxUploadBytes);
    const policy = FILE_TYPES[parsed.fileType];
    const fileId = randomUUID();
    const key = `${policy.folder}/${fileId}${policy.resourceType === 'raw' ? `.${policy.format}` : ''}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const parameters = {
      public_id: key,
      timestamp,
      type: 'authenticated',
      overwrite: false,
      upload_preset: this.config.uploadPreset,
      allowed_formats: policy.format,
    };
    try {
      return {
        fileId,
        url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(this.config.cloudName)}/${policy.resourceType}/upload`,
        method: 'POST',
        fields: {
          ...parameters,
          timestamp: String(timestamp),
          overwrite: 'false',
          api_key: this.config.apiKey,
          signature: cloudinary.utils.api_sign_request(
            parameters,
            this.config.apiSecret,
          ),
        },
        reference: {
          provider: 'CLOUDINARY',
          locator: {
            key,
            resourceType: policy.resourceType,
            deliveryType: 'authenticated',
            format: policy.format,
          },
        },
        expiresAt: timestamp + 3600,
      };
    } catch (error) {
      throw providerError(error);
    }
  }

  async inspect(reference: StorageReference): Promise<StorageObject> {
    const locator = validateReference(reference);
    try {
      const response: unknown = await cloudinary.api.resource(locator.key, {
        ...this.credentials,
        resource_type: locator.resourceType,
        type: locator.deliveryType,
      });
      const resource = parseResource(response);
      // Raw resources may omit format; their exact public ID contains the extension.
      const format =
        resource.format ??
        (locator.resourceType === 'raw'
          ? locator.key.split('.').pop()
          : undefined);
      if (
        resource.public_id !== locator.key ||
        resource.resource_type !== locator.resourceType ||
        format !== locator.format ||
        resource.bytes > this.config.maxUploadBytes
      ) {
        throw new StorageError(
          'INVALID_OBJECT',
          'Uploaded object does not match the storage policy.',
        );
      }
      return {
        reference: { provider: 'CLOUDINARY', locator: { ...locator, format } },
        sizeBytes: resource.bytes,
      };
    } catch (error) {
      throw providerError(error);
    }
  }

  // Keep signing failures consistent with the other asynchronous provider operations.
  // eslint-disable-next-line @typescript-eslint/require-await
  async createReadAccessUrl(
    reference: StorageReference,
  ): Promise<ReadAccessUrlResponse> {
    const locator = validateReference(reference);
    const expiresAt = Math.floor(Date.now() / 1000) + 900;
    try {
      return {
        url: cloudinary.utils.private_download_url(
          locator.key,
          locator.format,
          {
            ...this.credentials,
            resource_type: locator.resourceType,
            type: locator.deliveryType,
            expires_at: expiresAt,
            attachment: false,
          },
        ),
        expiresAt,
      };
    } catch (error) {
      throw providerError(error);
    }
  }

  async delete(reference: StorageReference): Promise<void> {
    const locator = validateReference(reference);
    try {
      const options = {
        ...this.credentials,
        resource_type: locator.resourceType,
        type: locator.deliveryType,
        invalidate: true,
      };
      const response: unknown = await cloudinary.uploader.destroy(
        locator.key,
        options,
      );
      parseDeletion(response);
    } catch (error) {
      const translated = providerError(error);
      if (translated.code !== 'NOT_FOUND') throw translated;
    }
  }
}
