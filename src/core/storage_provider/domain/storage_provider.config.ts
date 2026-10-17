import 'dotenv/config';

export const CLOUDINARY_CONFIG = Symbol('CLOUDINARY_CONFIG');

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function loadCloudinaryConfig(): CloudinaryConfig {
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    throw new Error(
      'CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required when importing StorageProviderModule.',
    );
  }

  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || 'dixczgeem',
    apiKey,
    apiSecret,
  };
}
