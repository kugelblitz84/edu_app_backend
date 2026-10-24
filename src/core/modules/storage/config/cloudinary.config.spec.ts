import { loadCloudinaryConfig } from './cloudinary.config';

describe('Cloudinary configuration', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
      CLOUDINARY_UPLOAD_PRESET: 'signed-preset',
    };
    delete process.env.CLOUDINARY_MAX_UPLOAD_BYTES;
    delete process.env.CLOUDINARY_CLOUD_NAME;
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads the default cloud and completion size policy', () => {
    expect(loadCloudinaryConfig()).toMatchObject({
      cloudName: 'dixczgeem',
      uploadPreset: 'signed-preset',
      maxUploadBytes: 10485760,
    });
  });

  it.each(['0', '-1', '1.5', 'invalid', 'Infinity'])(
    'rejects an invalid size policy %s',
    (value) => {
      process.env.CLOUDINARY_MAX_UPLOAD_BYTES = value;
      expect(() => loadCloudinaryConfig()).toThrow('positive safe integer');
    },
  );

  it('requires a configured signed preset', () => {
    delete process.env.CLOUDINARY_UPLOAD_PRESET;
    expect(() => loadCloudinaryConfig()).toThrow('CLOUDINARY_UPLOAD_PRESET');
  });
});
