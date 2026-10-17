import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider } from '../domain/contracts';
import {
  CLOUDINARY_CONFIG,
  type CloudinaryConfig,
} from '../domain/storage_provider.config';
import type {
  UploadInputDto,
  UploadUrlResponseDto,
  StorageReferenceDto,
  StorageObject,
  ReadAccessUrlResponseDto,
} from '../presentation/storage_service.dto';

interface CloudinaryResource {
  public_id: string;
  resource_type: StorageReferenceDto['resourceType'];
  type: string;
  bytes: number;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
}

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

  createUploadUrl(input: UploadInputDto): Promise<UploadUrlResponseDto> {
    const timestamp = Math.floor(Date.now() / 1000);
    const key = input.folder ? `${input.folder}/${randomUUID()}` : randomUUID();
    const parameters = {
      public_id: key,
      timestamp,
      type: 'authenticated',
      overwrite: false,
    };
    return Promise.resolve({
      url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(this.config.cloudName)}/${input.resourceType}/upload`,
      method: 'POST',
      fields: {
        public_id: key,
        timestamp: String(timestamp),
        type: parameters.type,
        overwrite: 'false',
        api_key: this.config.apiKey,
        signature: cloudinary.utils.api_sign_request(
          parameters,
          this.config.apiSecret,
        ),
      },
      reference: { key, resourceType: input.resourceType },
      expiresAt: timestamp + 3600,
    });
  }

  private async getResource(
    reference: StorageReferenceDto,
  ): Promise<CloudinaryResource> {
    const resource = (await cloudinary.api.resource(reference.key, {
      ...this.credentials,
      resource_type: reference.resourceType,
      type: 'authenticated',
    })) as CloudinaryResource;
    if (
      resource.public_id !== reference.key ||
      resource.resource_type !== reference.resourceType ||
      resource.type !== 'authenticated'
    ) {
      throw new Error('Cloudinary returned an unexpected storage object.');
    }
    return resource;
  }

  async inspect(reference: StorageReferenceDto): Promise<StorageObject> {
    const resource = await this.getResource(reference);
    return {
      reference: {
        key: resource.public_id,
        resourceType: resource.resource_type,
      },
      sizeBytes: resource.bytes,
      format: resource.format,
      width: resource.width,
      height: resource.height,
      durationSeconds: resource.duration,
    };
  }

  async createReadAccessUrl(
    reference: StorageReferenceDto,
  ): Promise<ReadAccessUrlResponseDto> {
    const resource = await this.getResource(reference);
    const expiresAt = Math.floor(Date.now() / 1000) + 900;
    return {
      url: cloudinary.utils.private_download_url(
        reference.key,
        resource.format ?? '',
        {
          ...this.credentials,
          resource_type: reference.resourceType,
          type: 'authenticated',
          expires_at: expiresAt,
          attachment: false,
        },
      ),
      expiresAt,
    };
  }

  async delete(reference: StorageReferenceDto): Promise<void> {
    const options = {
      ...this.credentials,
      resource_type: reference.resourceType,
      type: 'authenticated' as const,
      invalidate: true,
    };
    const result = (await cloudinary.uploader.destroy(
      reference.key,
      options,
    )) as { result: string };
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error('Cloudinary deletion failed.');
    }
  }
}
