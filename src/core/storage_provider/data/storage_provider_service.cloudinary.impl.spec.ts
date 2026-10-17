import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorageProviderService } from './storage_provider_service.cloudinary.impl';

jest.mock('cloudinary', () => ({
  v2: {
    utils: { api_sign_request: jest.fn(), private_download_url: jest.fn() },
    api: { resource: jest.fn() },
    uploader: { destroy: jest.fn() },
  },
}));

describe('CloudinaryStorageProviderService', () => {
  const config = {
    cloudName: 'test-cloud',
    apiKey: 'key',
    apiSecret: 'secret',
  };
  const service = new CloudinaryStorageProviderService(config);
  const reference = { key: 'docs/file', resourceType: 'raw' as const };
  const resource = {
    public_id: reference.key,
    resource_type: 'raw',
    type: 'authenticated',
    bytes: 123,
    format: 'pdf',
  };
  beforeEach(() => jest.resetAllMocks());

  it('returns signed multipart upload fields and the future reference', async () => {
    jest.mocked(cloudinary.utils.api_sign_request).mockReturnValue('signature');
    const result = await service.createUploadUrl({
      resourceType: 'raw',
      folder: 'docs',
    });
    expect(result.url).toBe(
      'https://api.cloudinary.com/v1_1/test-cloud/raw/upload',
    );
    expect(result.reference.key).toMatch(/^docs\//);
    expect(result.fields).toMatchObject({
      public_id: result.reference.key,
      type: 'authenticated',
      overwrite: 'false',
      api_key: 'key',
      signature: 'signature',
    });
    expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
      {
        public_id: result.reference.key,
        timestamp: Number(result.fields.timestamp),
        type: 'authenticated',
        overwrite: false,
      },
      config.apiSecret,
    );
    expect(result.expiresAt).toBe(Number(result.fields.timestamp) + 3600);
    expect(JSON.stringify(result)).not.toContain(config.apiSecret);
  });

  it('inspects provider metadata', async () => {
    jest.mocked(cloudinary.api.resource).mockResolvedValue(resource);
    await expect(service.inspect(reference)).resolves.toMatchObject({
      reference,
      sizeBytes: 123,
      format: 'pdf',
    });
    expect(cloudinary.api.resource).toHaveBeenCalledWith(
      reference.key,
      expect.objectContaining({ resource_type: 'raw', type: 'authenticated' }),
    );
  });

  it('rejects unexpected provider references', async () => {
    jest
      .mocked(cloudinary.api.resource)
      .mockResolvedValue({ ...resource, public_id: 'different' });
    await expect(service.inspect(reference)).rejects.toThrow(
      'unexpected storage object',
    );
  });

  it('propagates missing object errors from inspection', async () => {
    jest
      .mocked(cloudinary.api.resource)
      .mockRejectedValue(new Error('not found'));
    await expect(service.inspect(reference)).rejects.toThrow('not found');
  });

  it('creates expiring read access for an authenticated object', async () => {
    jest.mocked(cloudinary.api.resource).mockResolvedValue(resource);
    jest
      .mocked(cloudinary.utils.private_download_url)
      .mockReturnValue('https://example.com/signed');
    const result = await service.createReadAccessUrl(reference);
    expect(result.url).toBe('https://example.com/signed');
    expect(cloudinary.utils.private_download_url).toHaveBeenCalledWith(
      reference.key,
      'pdf',
      expect.objectContaining({
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: result.expiresAt,
        attachment: false,
      }),
    );
  });

  it.each(['ok', 'not found'])(
    'resolves deletion with result %s',
    async (result) => {
      jest.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result });
      await expect(service.delete(reference)).resolves.toBeUndefined();
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
        reference.key,
        expect.objectContaining({
          resource_type: 'raw',
          type: 'authenticated',
          invalidate: true,
        }),
      );
    },
  );

  it('rejects failed deletion', async () => {
    jest
      .mocked(cloudinary.uploader.destroy)
      .mockResolvedValue({ result: 'error' });
    await expect(service.delete(reference)).rejects.toThrow('deletion failed');
  });
});
