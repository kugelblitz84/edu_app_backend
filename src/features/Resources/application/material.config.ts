import { z } from 'zod';

export const MATERIAL_CONFIG = Symbol('MATERIAL_CONFIG');
export function loadMaterialConfig() {
  const positive = (fallback: number, max = 2147483647) =>
    z.coerce.number().int().positive().max(max).default(fallback);
  const values = z
    .object({
      MATERIAL_PDF_MAX_BYTES: positive(10 * 1024 * 1024),
      MATERIAL_VIDEO_MAX_BYTES: positive(10 * 1024 * 1024),
      MATERIAL_IMAGE_MAX_BYTES: positive(5 * 1024 * 1024),
      MATERIAL_COLLECTION_MAX_ITEMS: positive(500, 1000),
      MATERIAL_RESOURCE_MAX_COLLECTIONS: positive(100, 1000),
      MATERIAL_PENDING_MAX: positive(10, 100),
      MATERIAL_UPLOADS_PER_HOUR: positive(30),
      MATERIAL_PIN_TARGET_ATTEMPTS: positive(5),
      MATERIAL_PIN_IP_ATTEMPTS: positive(30),
      MATERIAL_CLEANUP_GRACE_SECONDS: positive(3600),
      MATERIAL_CLEANUP_POLL_MS: positive(30000),
      MATERIAL_CLEANUP_BATCH: positive(20, 100),
    })
    .parse(process.env);
  return {
    pdf: values.MATERIAL_PDF_MAX_BYTES,
    video: values.MATERIAL_VIDEO_MAX_BYTES,
    image: values.MATERIAL_IMAGE_MAX_BYTES,
    maxItems: values.MATERIAL_COLLECTION_MAX_ITEMS,
    maxCollections: values.MATERIAL_RESOURCE_MAX_COLLECTIONS,
    maxPending: values.MATERIAL_PENDING_MAX,
    uploadsPerHour: values.MATERIAL_UPLOADS_PER_HOUR,
    pinTargetAttempts: values.MATERIAL_PIN_TARGET_ATTEMPTS,
    pinIpAttempts: values.MATERIAL_PIN_IP_ATTEMPTS,
    cleanupGraceMs: values.MATERIAL_CLEANUP_GRACE_SECONDS * 1000,
    cleanupPollMs: values.MATERIAL_CLEANUP_POLL_MS,
    cleanupBatch: values.MATERIAL_CLEANUP_BATCH,
  };
}
export type MaterialConfig = ReturnType<typeof loadMaterialConfig>;
