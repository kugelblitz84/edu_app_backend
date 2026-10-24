import { z } from 'zod';

export const createArticleSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
    content: z.string().trim().min(10),
    accessPolicy: z.enum(['FREE', 'PURCHASE']).default('FREE'),
    priceAmountMinor: z.number().int().min(1).optional(),
    currency: z.string().trim().length(3).default('USD').optional(),
    pin: z.string().trim().min(1).max(32).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    coverImageUrl: z.string().url().max(2048).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
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
    content: z.string().trim().min(10).optional(),
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

