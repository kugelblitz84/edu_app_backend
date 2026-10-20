import { z } from 'zod';
import type {
  EnrollmentResult,
  InstitutionEntity,
  PendingEnrollmentRequest,
} from '../domain/institution.contracts';

export const enrollRequestSchema = z
  .object({
    simulatePayment: z.boolean().optional(),
  })
  .strict();

export type EnrollRequestDto = z.infer<typeof enrollRequestSchema>;

export const dummyPaymentSchema = z
  .object({
    paymentMethod: z.string().trim().min(1).max(50).optional(),
    transactionReference: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type DummyPaymentDto = z.infer<typeof dummyPaymentSchema>;

export const reviewEnrollmentSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export type ReviewEnrollmentDto = z.infer<typeof reviewEnrollmentSchema>;

export const listInstitutionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type ListInstitutionsQueryDto = z.infer<
  typeof listInstitutionsQuerySchema
>;

export interface EnrollmentResponseDto {
  success: boolean;
  enrollmentType: string;
  status: string;
  institutionId: string;
  userId: string;
  enrolledAt?: Date | null;
  requestedAt?: Date | null;
  message: string;
  paymentSession?: {
    checkoutUrl: string;
    sessionId: string;
    instructions: string;
  };
}

export interface UserEnrollmentStatusResponseDto {
  institutionId: string;
  userId: string;
  isEnrolled: boolean;
  status: string | null;
  enrolledAt: Date | null;
}

export interface PendingEnrollmentRequestResponseDto {
  institutionId: string;
  userId: string;
  status: string;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
  };
}

export interface InstitutionSummaryResponseDto {
  id: string;
  name: string;
  slug: string;
  status: string;
  institutionCode: string | null;
  logoUrl: string | null;
  description: string | null;
  enrollmentType: string;
  createdAt: Date;
}

export interface InstitutionListResponseDto {
  list: InstitutionSummaryResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export function toInstitutionSummaryDto(
  entity: InstitutionEntity,
): InstitutionSummaryResponseDto {
  return {
    id: entity.id,
    name: entity.name,
    slug: entity.slug,
    status: entity.status,
    institutionCode: entity.institutionCode,
    logoUrl: entity.logoUrl,
    description: entity.description,
    enrollmentType: entity.enrollmentType,
    createdAt: entity.createdAt,
  };
}

export function toEnrollmentResponseDto(
  result: EnrollmentResult,
): EnrollmentResponseDto {
  return {
    success: result.success,
    enrollmentType: result.enrollmentType,
    status: result.status,
    institutionId: result.institutionId,
    userId: result.userId,
    enrolledAt: result.enrolledAt,
    requestedAt: result.requestedAt,
    message: result.message,
    paymentSession: result.paymentSession,
  };
}

export function toPendingEnrollmentResponseDto(
  request: PendingEnrollmentRequest,
): PendingEnrollmentRequestResponseDto {
  return {
    institutionId: request.institutionId,
    userId: request.userId,
    status: request.status,
    createdAt: request.createdAt,
    user: request.user,
  };
}

