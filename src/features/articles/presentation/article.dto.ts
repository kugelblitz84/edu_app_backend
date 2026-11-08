import { z } from 'zod';

export const articleFontFamilySchema = z
  .enum([
    'Inter',
    'Roboto',
    'Merriweather',
    'Playfair Display',
    'Fira Code',
    'System',
  ])
  .or(z.string().trim().min(1).max(50));

export const articleTextAlignmentSchema = z.enum([
  'left',
  'center',
  'right',
  'justify',
]);

export const sectionLayoutTypeSchema = z.enum([
  'SINGLE_COLUMN',
  'TWO_COLUMN_EQUAL',
  'TWO_COLUMN_WIDE_LEFT',
  'MEDIA_TEXT_SPLIT',
]);

export const blockTypeSchema = z.enum([
  'HEADING',
  'PARAGRAPH',
  'IMAGE',
  'QUOTE',
  'DIVIDER',
]);

export const imagePlacementSchema = z.enum([
  'CONTAINED',
  'FULL_BLEED',
  'FLOAT_LEFT',
  'FLOAT_RIGHT',
]);

export const sectionStyleSchema = z
  .object({
    fontFamily: articleFontFamilySchema.optional(),
    backgroundColor: z.string().trim().max(30).optional(),
    textColor: z.string().trim().max(30).optional(),
    paddingY: z.enum(['compact', 'normal', 'spacious']).optional(),
  })
  .strict();

export const headingBlockSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    type: z.literal('HEADING'),
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    text: z.string().max(10000),
    align: articleTextAlignmentSchema.optional(),
    fontFamily: articleFontFamilySchema.optional(),
  })
  .strict();

export const paragraphBlockSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    type: z.literal('PARAGRAPH'),
    html: z.string().max(50000),
    align: articleTextAlignmentSchema.optional(),
    fontSize: z.enum(['sm', 'base', 'lg']).optional(),
    fontFamily: articleFontFamilySchema.optional(),
  })
  .strict();

export const imageBlockSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    type: z.literal('IMAGE'),
    url: z.string().url().max(2048),
    altText: z.string().max(200).optional(),
    caption: z.string().max(500).optional(),
    placement: imagePlacementSchema.optional(),
    aspectRatio: z.enum(['16:9', '4:3', '1:1', 'auto']).optional(),
    widthPercentage: z.number().min(10).max(100).optional(),
  })
  .strict();

export const quoteBlockSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    type: z.literal('QUOTE'),
    text: z.string().max(10000),
    author: z.string().max(100).optional(),
    style: z.enum(['modern', 'classic', 'highlight']).optional(),
  })
  .strict();

export const dividerBlockSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    type: z.literal('DIVIDER'),
  })
  .strict();

export const articleBlockSchema = z.discriminatedUnion('type', [
  headingBlockSchema,
  paragraphBlockSchema,
  imageBlockSchema,
  quoteBlockSchema,
  dividerBlockSchema,
]);

export const articleSectionSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    layout: sectionLayoutTypeSchema.default('SINGLE_COLUMN'),
    style: sectionStyleSchema.optional(),
    blocks: z.array(articleBlockSchema).optional(),
    columnLeft: z.array(articleBlockSchema).optional(),
    columnRight: z.array(articleBlockSchema).optional(),
  })
  .strict();

export const articleThemeSchema = z
  .object({
    baseFont: articleFontFamilySchema.default('Inter'),
    headingFont: articleFontFamilySchema.default('Playfair Display'),
    containerWidth: z.enum(['normal', 'wide', 'narrow']).default('normal'),
  })
  .strict();

export const createArticleSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
    content: z.string().trim().min(1).optional(),
    theme: articleThemeSchema.optional(),
    sections: z.array(articleSectionSchema).optional(),
    accessPolicy: z.enum(['FREE', 'PURCHASE']).default('FREE'),
    priceAmountMinor: z.number().int().min(1).optional(),
    currency: z.string().trim().length(3).default('USD').optional(),
    pin: z.string().trim().min(1).max(32).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    coverImageUrl: z.string().url().max(2048).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!val.content && (!val.sections || val.sections.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sections'],
        message: 'Either content or at least one section must be provided.',
      });
    }
    if (val.accessPolicy === 'PURCHASE' && !val.pin) {
      ctx.addIssue({
        code: 'custom',
        path: ['pin'],
        message: 'A PIN is required for PURCHASE (Paid) articles.',
      });
    }
    if (val.accessPolicy === 'FREE' && val.pin) {
      ctx.addIssue({
        code: 'custom',
        path: ['pin'],
        message: 'PIN is only valid for PURCHASE (Paid) articles.',
      });
    }
  });

export type CreateArticleDto = z.infer<typeof createArticleSchema>;

export const updateArticleSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    content: z.string().trim().min(1).optional(),
    theme: articleThemeSchema.optional(),
    sections: z.array(articleSectionSchema).optional(),
    accessPolicy: z.enum(['FREE', 'PURCHASE']).optional(),
    priceAmountMinor: z.number().int().min(1).optional(),
    currency: z.string().trim().length(3).optional(),
    pin: z.string().trim().min(1).max(32).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    coverImageUrl: z.string().url().max(2048).optional(),
  })
  .strict();

export type UpdateArticleDto = z.infer<typeof updateArticleSchema>;

export const unlockArticleSchema = z
  .object({
    pin: z.string().trim().min(1).max(32),
  })
  .strict();

export type UnlockArticleDto = z.infer<typeof unlockArticleSchema>;

export const articleQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    tag: z.string().trim().min(1).max(40).optional(),
    policy: z.enum(['FREE', 'PURCHASE']).optional(),
  })
  .strict();

export type ArticleQueryDto = z.infer<typeof articleQuerySchema>;

export const adminArticleReviewSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED']),
    rejectReason: z.string().trim().min(1).max(500).optional(),
    reviewNotes: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.status === 'REJECTED' && !val.rejectReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['rejectReason'],
        message: 'A rejection reason is required when rejecting an article.',
      });
    }
    if (val.status === 'APPROVED' && val.rejectReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['rejectReason'],
        message: 'Rejection reason is not allowed for approved articles.',
      });
    }
  });

export type AdminArticleReviewDto = z.infer<typeof adminArticleReviewSchema>;

export const adminArticleQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    policy: z.enum(['FREE', 'PURCHASE']).optional(),
  })
  .strict();

export type AdminArticleQueryDto = z.infer<typeof adminArticleQuerySchema>;

export const adminRespondedQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type AdminRespondedQueryDto = z.infer<typeof adminRespondedQuerySchema>;
