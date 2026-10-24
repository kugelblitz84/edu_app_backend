import { z } from 'zod';
import { STORAGE_FILE_TYPES } from '../../../core/modules/storage/domain/storage.types';

export const policySchema = z.enum([
  'FREE',
  'OWNER_ONLY',
  'ENROLLED',
  'PURCHASE',
]);
export const pinSchema = z
  .string()
  .regex(/^\d{6,12}$/, 'PIN must contain 6–12 digits.');
export const versionSchema = z
  .object({ version: z.number().int().positive() })
  .strict();
const currencyCodes = new Set(
  'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XCD XDR XOF XPF YER ZAR ZMW ZWG'.split(
    ' ',
  ),
);
const fields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).nullable().optional(),
  accessPolicy: policySchema,
  pin: pinSchema.optional(),
  priceAmountMinor: z
    .number()
    .int()
    .positive()
    .max(2147483647)
    .nullable()
    .optional(),
  currency: z
    .string()
    .refine(
      (value) => currencyCodes.has(value),
      'Use an ISO 4217 currency code.',
    )
    .nullable()
    .optional(),
  metadata: z
    .object({
      author: z.string().trim().max(160).optional(),
      tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
      externalLink: z
        .url()
        .max(2000)
        .refine((value) => /^https?:\/\//.test(value))
        .optional(),
    })
    .strict()
    .nullable()
    .optional(),
};
export const createCollectionSchema = z
  .object({ ...fields, institutionId: z.uuid().optional() })
  .strict();
export const createResourceSchema = createCollectionSchema
  .extend({
    type: z.enum(['PDF', 'VIDEO']),
    isStandalone: z.boolean().optional(),
    collectionId: z.uuid().optional(),
    collectionVersion: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (value) => !value.collectionId || value.collectionVersion !== undefined,
    'collectionVersion is required with collectionId.',
  );
export const updateCollectionSchema = z
  .object(fields)
  .partial()
  .extend({ version: z.number().int().positive() })
  .strict();
export const updateResourceSchema = updateCollectionSchema
  .extend({ isStandalone: z.boolean().optional() })
  .strict();
export const uploadSchema = versionSchema
  .extend({
    purpose: z.enum(['RESOURCE_CONTENT', 'RESOURCE_THUMBNAIL']),
    fileType: z.enum(STORAGE_FILE_TYPES),
    sizeBytes: z.number().int().positive().max(2147483647),
  })
  .strict();
export const coverUploadSchema = versionSchema
  .extend({
    fileType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z.number().int().positive().max(2147483647),
  })
  .strict();
export const unlockSchema = z.object({ pin: pinSchema }).strict();
export const rotatePinSchema = versionSchema
  .extend({ pin: pinSchema })
  .strict();
export const addItemSchema = versionSchema
  .extend({
    resourceId: z.uuid(),
    position: z.number().int().min(0).optional(),
  })
  .strict();
export const orderSchema = versionSchema
  .extend({
    resourceIds: z
      .array(z.uuid())
      .min(1)
      .max(1000)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Duplicate resource IDs.',
      ),
  })
  .strict();
export const publicQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
    type: z.enum(['PDF', 'VIDEO']).optional(),
    institutionId: z.uuid().optional(),
    accessPolicy: policySchema.optional(),
    sort: z.enum(['newest', 'oldest', 'title']).default('newest'),
  })
  .strict();
export const managementQuerySchema = publicQuerySchema
  .extend({ status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional() })
  .strict();
export const contextQuerySchema = z
  .object({ collectionId: z.uuid().optional() })
  .strict();
export const itemQuerySchema = publicQuerySchema
  .pick({ page: true, limit: true })
  .strict();
export type CreateMaterialInput = z.infer<typeof createCollectionSchema> &
  Partial<
    Pick<
      z.infer<typeof createResourceSchema>,
      'type' | 'isStandalone' | 'collectionId' | 'collectionVersion'
    >
  >;
export type UpdateMaterialInput = z.infer<typeof updateResourceSchema>;
export type UploadRequest = z.infer<typeof uploadSchema>;
export type CoverUploadRequest = z.infer<typeof coverUploadSchema>;
export type VersionInput = z.infer<typeof versionSchema>;
export type PinInput = z.infer<typeof unlockSchema>;
export type RotatePinInput = z.infer<typeof rotatePinSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type PublicQuery = z.infer<typeof publicQuerySchema>;
export type ManagementQuery = z.infer<typeof managementQuerySchema>;
export type ContextQuery = z.infer<typeof contextQuerySchema>;
export type ItemQuery = z.infer<typeof itemQuerySchema>;
