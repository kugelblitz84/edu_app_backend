import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorageProviderService } from './cloudinary-storage-provider.service';
import { validateReference } from './cloudinary.schemas';
import {
  toUploadUrlResponseDto,
  uploadInputSchema,
  storageFileRequestSchema,
} from '../../presentation/storage.dto';
import type { StorageReference, UploadInput } from '../../domain/storage.types';

jest.mock('cloudinary', () => ({
  v2: {
    utils: {
      api_sign_request: jest.fn(() => 'signature'),
      private_download_url: jest.fn(() => 'https://example.com/read'),
    },
    api: { resource: jest.fn() },
    uploader: { destroy: jest.fn() },
  },
}));

const config = {
  cloudName: 'test',
  apiKey: 'key',
  apiSecret: 'secret',
  uploadPreset: 'restricted',
  maxUploadBytes: 1024,
};
const service = new CloudinaryStorageProviderService(config);
const reference: StorageReference = {
  provider: 'CLOUDINARY',
  locator: {
    key: 'materials/00000000-0000-4000-8000-000000000000.pdf',
    resourceType: 'raw',
    deliveryType: 'authenticated',
    format: 'pdf',
  },
};
const resource = {
  public_id: reference.locator.key,
  resource_type: 'raw',
  type: 'authenticated',
  bytes: 100,
};

describe('Cloudinary storage', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['application/pdf', 'raw', 'pdf', true],
    ['image/jpeg', 'image', 'jpg', false],
    ['image/png', 'image', 'png', false],
    ['image/webp', 'image', 'webp', false],
    ['video/mp4', 'video', 'mp4', false],
  ] as const)(
    'maps %s to a signed provider upload',
    async (fileType, resourceType, format, extension) => {
      const result = await service.createUploadUrl({
        fileType,
        sizeBytes: 100,
      });
      expect(result.reference.locator).toMatchObject({
        resourceType,
        format,
        deliveryType: 'authenticated',
      });
      expect(
        validateReference(result.reference).key.endsWith(`.${format}`),
      ).toBe(extension);
      expect(result.fields).toMatchObject({
        upload_preset: config.uploadPreset,
        allowed_formats: format,
        overwrite: 'false',
        type: 'authenticated',
      });
      expect(result.reference.locator.key).toContain(result.fileId);
      expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
        expect.objectContaining({
          allowed_formats: format,
          upload_preset: config.uploadPreset,
        }),
        config.apiSecret,
      );
      expect(toUploadUrlResponseDto(result)).not.toHaveProperty('reference');
      expect(result).not.toHaveProperty('apiSecret');
    },
  );

  it.each([
    { fileType: 'application/x-executable', sizeBytes: 100 },
    { fileType: 'application/pdf', sizeBytes: 1025 },
    { fileType: 'application/pdf', sizeBytes: 0 },
    { fileType: 'application/pdf', sizeBytes: 1.5 },
    { fileType: 'application/pdf', sizeBytes: 100, resourceType: 'video' },
    { fileType: 'application/pdf', sizeBytes: 100, folder: '../escape' },
  ])('rejects invalid input %j', async (input) => {
    await expect(
      service.createUploadUrl(input as UploadInput),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(cloudinary.utils.api_sign_request).not.toHaveBeenCalled();
  });

  it('verifies raw metadata and returns a reference for persistence', async () => {
    jest.mocked(cloudinary.api.resource).mockResolvedValue(resource);
    await expect(service.inspect(reference)).resolves.toEqual({
      reference,
      sizeBytes: 100,
    });
  });

  it.each([0, -1, 1.5, NaN, Infinity, '100', undefined, 1025])(
    'rejects invalid provider bytes %s',
    async (bytes) => {
      jest
        .mocked(cloudinary.api.resource)
        .mockResolvedValue({ ...resource, bytes });
      await expect(service.inspect(reference)).rejects.toMatchObject({
        code: 'INVALID_OBJECT',
      });
    },
  );

  it.each([
    { public_id: 'other' },
    { resource_type: 'image' },
    { type: 'upload' },
    { format: 'exe' },
  ])('rejects mismatched provider metadata %j', async (change) => {
    jest
      .mocked(cloudinary.api.resource)
      .mockResolvedValue({ ...resource, ...change });
    await expect(service.inspect(reference)).rejects.toMatchObject({
      code: 'INVALID_OBJECT',
    });
  });

  it('generates repeated downloads without inspecting', async () => {
    await service.createReadAccessUrl(reference);
    const result = await service.createReadAccessUrl(reference);
    expect(cloudinary.api.resource).not.toHaveBeenCalled();
    expect(cloudinary.utils.private_download_url).toHaveBeenCalledWith(
      reference.locator.key,
      'pdf',
      expect.objectContaining({
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: result.expiresAt,
      }),
    );
  });

  it.each([
    [404, 'NOT_FOUND'],
    [401, 'FORBIDDEN'],
    [403, 'FORBIDDEN'],
    [420, 'RATE_LIMITED'],
    [429, 'RATE_LIMITED'],
    [500, 'UNAVAILABLE'],
    [400, 'INVALID_INPUT'],
  ] as const)('translates provider status %s', async (http_code, code) => {
    jest.mocked(cloudinary.api.resource).mockRejectedValue({ http_code });
    await expect(service.inspect(reference)).rejects.toMatchObject({ code });
  });

  it('translates network errors', async () => {
    jest
      .mocked(cloudinary.api.resource)
      .mockRejectedValue(new Error('connection reset'));
    await expect(service.inspect(reference)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
  });

  it.each(['ok', 'not found'])(
    'allows idempotent deletion %s',
    async (result) => {
      jest.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result });
      await expect(service.delete(reference)).resolves.toBeUndefined();
    },
  );

  it('rejects invalid references before any provider call', async () => {
    await expect(
      service.createReadAccessUrl({
        ...reference,
        locator: { ...reference.locator, resourceType: 'auto' },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(cloudinary.utils.private_download_url).not.toHaveBeenCalled();
  });

  it('accepts only application file IDs in presentation requests', () => {
    expect(
      storageFileRequestSchema.safeParse({
        fileId: '00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(true);
    expect(storageFileRequestSchema.safeParse(reference).success).toBe(false);
    expect(
      uploadInputSchema.safeParse({
        fileType: 'application/pdf',
        sizeBytes: 100,
        folder: 'user-folder',
      }).success,
    ).toBe(false);
  });
});
