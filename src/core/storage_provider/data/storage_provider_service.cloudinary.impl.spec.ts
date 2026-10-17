import { PassThrough } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorageProviderService } from './storage_provider_service.cloudinary.impl';
import { loadCloudinaryConfig } from '../domain/storage_provider.config';

jest.mock('cloudinary', () => ({
  v2: { uploader: { upload_stream: jest.fn(), destroy: jest.fn() } },
}));

describe('CloudinaryStorageProviderService', () => {
  const config = {
    cloudName: 'test-cloud',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  };
  const service = new CloudinaryStorageProviderService(config);
  const uploadStream = jest.mocked(cloudinary.uploader.upload_stream);
  const destroy = jest.mocked(cloudinary.uploader.destroy);

  beforeEach(() => jest.resetAllMocks());

  it('streams bytes and maps provider metadata to a storage object', async () => {
    const stream = new PassThrough();
    const data = Buffer.from('file');
    uploadStream.mockReturnValue(stream);
    const pending = service.upload({
      data,
      resourceType: 'raw',
      folder: 'docs',
    });
    expect(stream.read()).toEqual(data);
    expect(uploadStream.mock.calls[0][0]).toMatchObject({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      resource_type: 'raw',
      folder: 'docs',
      overwrite: false,
    });
    const callback = uploadStream.mock.calls[0][1]!;
    callback(undefined, {
      public_id: 'docs/file.pdf',
      secure_url: 'https://example.com/file.pdf',
      bytes: 4,
      format: 'pdf',
    });
    await expect(pending).resolves.toEqual({
      key: 'docs/file.pdf',
      resourceType: 'raw',
      url: 'https://example.com/file.pdf',
      sizeBytes: 4,
      format: 'pdf',
    });
  });

  it('rejects empty input before contacting the provider', async () => {
    await expect(
      service.upload({ data: Buffer.alloc(0), resourceType: 'image' }),
    ).rejects.toThrow('non-empty Buffer');
    expect(uploadStream).not.toHaveBeenCalled();
  });

  it('rejects provider errors', async () => {
    uploadStream.mockReturnValue(new PassThrough());
    const pending = service.upload({
      data: Buffer.from('file'),
      resourceType: 'image',
    });
    uploadStream.mock.calls[0][1]!({
      message: 'failed',
      name: 'Error',
      http_code: 500,
    });
    await expect(pending).rejects.toThrow('Cloudinary upload failed');
  });

  it('rejects stream errors', async () => {
    const stream = new PassThrough();
    uploadStream.mockReturnValue(stream);
    const pending = service.upload({
      data: Buffer.from('file'),
      resourceType: 'image',
    });
    stream.emit('error', new Error('connection closed'));
    await expect(pending).rejects.toThrow('upload stream failed');
  });

  it.each([
    ['ok', true],
    ['not found', false],
  ])('handles deletion result %s', async (result, deleted) => {
    destroy.mockResolvedValue({ result });
    await expect(
      service.delete({ key: 'video-id', resourceType: 'video' }),
    ).resolves.toEqual({ deleted });
    expect(destroy).toHaveBeenCalledWith(
      'video-id',
      expect.objectContaining({ resource_type: 'video', invalidate: true }),
    );
  });

  it('rejects unexpected deletion results', async () => {
    destroy.mockResolvedValue({ result: 'error' });
    await expect(
      service.delete({ key: 'id', resourceType: 'image' }),
    ).rejects.toThrow('deletion failed');
  });
});

describe('loadCloudinaryConfig', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('requires credentials', () => {
    delete process.env.CLOUDINARY_API_SECRET;
    expect(() => loadCloudinaryConfig()).toThrow('CLOUDINARY_API_SECRET');
  });

  it('uses the supplied cloud as the default', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_API_KEY = 'key';
    process.env.CLOUDINARY_API_SECRET = 'secret';
    expect(loadCloudinaryConfig().cloudName).toBe('dixczgeem');
  });
});
