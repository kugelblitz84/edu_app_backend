import { Inject, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import {
  StorageProviderService,
  type DeleteStorageObjectResult,
  type StorageObjectReference,
  type StoredStorageObject,
  type UploadStorageObject,
} from '../domain/contracts';
import {
  CLOUDINARY_CONFIG,
  type CloudinaryConfig,
} from '../domain/storage_provider.config';

@Injectable()
export class CloudinaryStorageProviderService implements StorageProviderService {
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

  upload(input: UploadStorageObject): Promise<StoredStorageObject> {
    if (!Buffer.isBuffer(input.data) || input.data.length === 0) {
      return Promise.reject(new Error('File data must be a non-empty Buffer.'));
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          ...this.credentials,
          resource_type: input.resourceType,
          folder: input.folder,
          overwrite: false,
          timeout: 60_000,
        },
        (error, result) => {
          if (error) {
            reject(new Error('Cloudinary upload failed.', { cause: error }));
            return;
          }
          if (!result) {
            reject(new Error('Cloudinary upload returned no result.'));
            return;
          }
          resolve({
            key: result.public_id,
            resourceType: input.resourceType,
            url: result.secure_url,
            sizeBytes: result.bytes,
            format: result.format,
          });
        },
      );
      stream.on('error', (error) => {
        reject(new Error('Cloudinary upload stream failed.', { cause: error }));
      });
      stream.end(input.data);
    });
  }

  async delete(
    input: StorageObjectReference,
  ): Promise<DeleteStorageObjectResult> {
    if (!input.key.trim()) {
      throw new Error('Storage object key must not be empty.');
    }
    const options = {
      ...this.credentials,
      resource_type: input.resourceType,
      invalidate: true,
      timeout: 60_000,
    };
    const result = (await cloudinary.uploader.destroy(input.key, options)) as {
      result: string;
    };

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error('Cloudinary deletion failed.');
    }
    return { deleted: result.result === 'ok' };
  }
}
