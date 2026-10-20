import type {
  EnrollmentStatus,
  EnrollmentType,
  InstitutionStatus,
} from '@prisma/client';

export type { EnrollmentStatus, EnrollmentType, InstitutionStatus };

export interface InstitutionEntity {
  id: string;
  name: string;
  slug: string;
  status: InstitutionStatus;
  institutionCode: string | null;
  logoUrl: string | null;
  description: string | null;
  enrollmentType: EnrollmentType;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnrollmentEntity {
  institutionId: string;
  userId: string;
  status: EnrollmentStatus;
  enrolledAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingEnrollmentRequestUser {
  id: string;
  email: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
}

export interface PendingEnrollmentRequest {
  institutionId: string;
  userId: string;
  status: EnrollmentStatus;
  createdAt: Date;
  updatedAt: Date;
  user: PendingEnrollmentRequestUser;
}

export interface DummyPaymentSession {
  checkoutUrl: string;
  sessionId: string;
  instructions: string;
}

export interface EnrollmentResult {
  success: boolean;
  enrollmentType: EnrollmentType;
  status: EnrollmentStatus | 'PAYMENT_REQUIRED';
  institutionId: string;
  userId: string;
  enrolledAt?: Date | null;
  requestedAt?: Date | null;
  message: string;
  paymentSession?: DummyPaymentSession;
}

export interface ReviewEnrollmentDecision {
  status: 'APPROVED' | 'REJECTED';
  note?: string;
}

export interface ListInstitutionsOptions {
  page: number;
  limit: number;
  search?: string;
}

export interface InstitutionPage {
  list: InstitutionEntity[];
  total: number;
  page: number;
  limit: number;
}

export abstract class InstitutionRepository {
  abstract findById(id: string): Promise<InstitutionEntity | null>;
  abstract findBySlug(slug: string): Promise<InstitutionEntity | null>;
  abstract findEnrollment(
    institutionId: string,
    userId: string,
  ): Promise<EnrollmentEntity | null>;
  abstract upsertEnrollment(data: {
    institutionId: string;
    userId: string;
    status: EnrollmentStatus;
    enrolledAt?: Date | null;
    expiresAt?: Date | null;
  }): Promise<EnrollmentEntity>;
  abstract isInstitutionAdmin(
    institutionId: string,
    userId: string,
  ): Promise<boolean>;
  abstract findPendingEnrollmentRequests(
    institutionId: string,
  ): Promise<PendingEnrollmentRequest[]>;
  abstract findActiveInstitutions(
    options: ListInstitutionsOptions,
  ): Promise<{ list: InstitutionEntity[]; total: number }>;
}

