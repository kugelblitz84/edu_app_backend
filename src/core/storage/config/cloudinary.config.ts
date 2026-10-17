import 'dotenv/config';

export const CLOUDINARY_CONFIG = Symbol('CLOUDINARY_CONFIG');
export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadPreset: string;
  maxUploadBytes: number;
}

export function loadCloudinaryConfig(): CloudinaryConfig {
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!apiKey || !apiSecret || !uploadPreset) {
    throw new Error(
      'CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and CLOUDINARY_UPLOAD_PRESET are required when importing StorageModule.',
    );
  }
  const maxUploadBytes = Number(
    process.env.CLOUDINARY_MAX_UPLOAD_BYTES ?? 10485760,
  );
  if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes < 1) {
    throw new Error(
      'CLOUDINARY_MAX_UPLOAD_BYTES must be a positive safe integer.',
    );
  }
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || 'dixczgeem',
    apiKey,
    apiSecret,
    uploadPreset,
    maxUploadBytes,
  };
}
