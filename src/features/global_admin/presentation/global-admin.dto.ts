import { z } from 'zod';
import type { InstitutionReview } from '../domain/contracts/repositories';

export const institutionReviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    sortBy: z.enum(['name', 'createdAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export type GetPendingInstitutionApprovalRequestDto = z.infer<
  typeof institutionReviewQuerySchema
>;

export const respondedReviewQuerySchema = institutionReviewQuerySchema.extend({
  sortBy: z.enum(['name', 'respondedAt']).default('respondedAt'),
});

export type GetRespondedInstitutionApprovalRequestDto = z.infer<
  typeof respondedReviewQuerySchema
>;

export const approvalResponseSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED']),
    rejectReason: z.string().trim().min(1).max(500).optional(),
    notes: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'REJECTED' && !value.rejectReason) {
      context.addIssue({
        code: 'custom',
        path: ['rejectReason'],
        message: 'A rejection reason is required.',
      });
    }
    if (value.status === 'APPROVED' && value.rejectReason) {
      context.addIssue({
        code: 'custom',
        path: ['rejectReason'],
        message: 'A rejection reason is only valid for rejected applications.',
      });
    }
  });

export type ApprovalResponseInstitutionRequestDto = z.infer<
  typeof approvalResponseSchema
>;

export interface PendingInstitutionApprovalResponseDto {
  list: {
    id: string;
    name: string;
    logo_url: string | null;
    requestedByUserId: string;
    createdAt: Date;
  }[];
  page: number;
  limit: number;
  total: number;
}

export interface ApprovedOrRejectedByMeResponseDto {
  list: {
    id: string;
    verdict: 'APPROVED' | 'REJECTED';
    name: string;
    logo_url: string | null;
    respondedAt: Date;
    rejectReason: string | null;
  }[];
  page: number;
  limit: number;
  total: number;
}

export interface InstitutionDecisionResponseDto {
  id: string;
  name: string;
  status: 'ACTIVE' | 'REJECTED';
  verdict: 'APPROVED' | 'REJECTED';
  institutionCode: string | null;
  rejectReason: string | null;
  respondedAt: Date;
}

export function toDecisionResponse(
  review: InstitutionReview,
): InstitutionDecisionResponseDto {
  return {
    id: review.id,
    name: review.name,
    status: review.reviewVerdict === 'APPROVED' ? 'ACTIVE' : 'REJECTED',
    verdict: review.reviewVerdict!,
    institutionCode: review.institutionCode,
    rejectReason: review.rejectReason,
    respondedAt: review.respondedAt!,
  };
}
