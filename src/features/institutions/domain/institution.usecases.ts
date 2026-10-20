import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import {
  InstitutionRepository,
  type DummyPaymentSession,
  type EnrollmentResult,
  type InstitutionEntity,
  type InstitutionPage,
  type ListInstitutionsOptions,
  type PendingEnrollmentRequest,
  type ReviewEnrollmentDecision,
} from './institution.contracts';

export interface EnrollRequestInput {
  simulatePayment?: boolean;
}

export interface DummyPaymentInput {
  paymentMethod?: string;
  transactionReference?: string;
}

export interface UserEnrollmentStatus {
  institutionId: string;
  userId: string;
  isEnrolled: boolean;
  status: string | null;
  enrolledAt: Date | null;
}

@Injectable()
export class InstitutionUseCases {
  constructor(private readonly repository: InstitutionRepository) {}

  async enroll(
    institutionId: string,
    user: AuthenticatedUser,
    input?: EnrollRequestInput,
  ): Promise<EnrollmentResult> {
    const institution = await this.repository.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institution not found.');
    }

    if (institution.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cannot enroll in an institution that is not active.',
      );
    }

    const existing = await this.repository.findEnrollment(
      institutionId,
      user.userId,
    );

    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new ConflictException(
          'You are already actively enrolled in this institution.',
        );
      }
      if (existing.status === 'PENDING') {
        throw new ConflictException(
          'An enrollment request is already pending approval.',
        );
      }
      if (existing.status === 'SUSPENDED') {
        throw new ForbiddenException(
          'Your enrollment in this institution is currently suspended.',
        );
      }
    }

    const now = new Date();

    switch (institution.enrollmentType) {
      case 'FREE': {
        await this.repository.upsertEnrollment({
          institutionId,
          userId: user.userId,
          status: 'ACTIVE',
          enrolledAt: now,
        });

        return {
          success: true,
          enrollmentType: 'FREE',
          status: 'ACTIVE',
          institutionId,
          userId: user.userId,
          enrolledAt: now,
          message: 'Successfully enrolled in institution.',
        };
      }

      case 'PAID': {
        if (input?.simulatePayment) {
          await this.repository.upsertEnrollment({
            institutionId,
            userId: user.userId,
            status: 'ACTIVE',
            enrolledAt: now,
          });

          return {
            success: true,
            enrollmentType: 'PAID',
            status: 'ACTIVE',
            institutionId,
            userId: user.userId,
            enrolledAt: now,
            message:
              'Dummy payment processed successfully. You are now enrolled.',
          };
        }

        const dummySession: DummyPaymentSession = {
          checkoutUrl: `/v1/institutions/${institutionId}/enroll/dummy-pay`,
          sessionId: `mock_sess_${Date.now()}_${user.userId.slice(0, 8)}`,
          instructions:
            'Call the dummy payment endpoint to simulate payment completion.',
        };

        return {
          success: true,
          enrollmentType: 'PAID',
          status: 'PAYMENT_REQUIRED',
          institutionId,
          userId: user.userId,
          message:
            'Payment required for enrollment. Please complete payment via the dummy payment endpoint.',
          paymentSession: dummySession,
        };
      }

      case 'INVITE_ONLY': {
        await this.repository.upsertEnrollment({
          institutionId,
          userId: user.userId,
          status: 'PENDING',
          enrolledAt: null,
        });

        return {
          success: true,
          enrollmentType: 'INVITE_ONLY',
          status: 'PENDING',
          institutionId,
          userId: user.userId,
          requestedAt: now,
          message:
            'Enrollment request submitted successfully. Awaiting administrator approval.',
        };
      }

      default: {
        throw new BadRequestException('Unsupported enrollment type.');
      }
    }
  }

  async processDummyPayment(
    institutionId: string,
    user: AuthenticatedUser,
    input?: DummyPaymentInput,
  ): Promise<EnrollmentResult> {
    void input;
    const institution = await this.repository.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institution not found.');
    }

    if (institution.status !== 'ACTIVE') {
      throw new BadRequestException('Institution is not active.');
    }

    if (institution.enrollmentType !== 'PAID') {
      throw new BadRequestException(
        'Institution does not require paid enrollment.',
      );
    }

    const existing = await this.repository.findEnrollment(
      institutionId,
      user.userId,
    );

    if (existing?.status === 'ACTIVE') {
      throw new ConflictException(
        'You are already actively enrolled in this institution.',
      );
    }

    if (existing?.status === 'SUSPENDED') {
      throw new ForbiddenException(
        'Your enrollment in this institution is currently suspended.',
      );
    }

    const now = new Date();
    await this.repository.upsertEnrollment({
      institutionId,
      userId: user.userId,
      status: 'ACTIVE',
      enrolledAt: now,
    });

    return {
      success: true,
      enrollmentType: 'PAID',
      status: 'ACTIVE',
      institutionId,
      userId: user.userId,
      enrolledAt: now,
      message: 'Dummy payment processed successfully. You are now enrolled.',
    };
  }

  async getEnrollmentStatus(
    institutionId: string,
    userId: string,
  ): Promise<UserEnrollmentStatus> {
    const institution = await this.repository.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institution not found.');
    }

    const enrollment = await this.repository.findEnrollment(
      institutionId,
      userId,
    );

    return {
      institutionId,
      userId,
      isEnrolled: enrollment?.status === 'ACTIVE',
      status: enrollment?.status ?? null,
      enrolledAt: enrollment?.enrolledAt ?? null,
    };
  }

  async listPendingEnrollments(
    institutionId: string,
    user: AuthenticatedUser,
  ): Promise<PendingEnrollmentRequest[]> {
    const institution = await this.repository.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institution not found.');
    }

    const isAdmin =
      user.platformRole === 'GLOBAL_ADMIN' ||
      (await this.repository.isInstitutionAdmin(institutionId, user.userId));

    if (!isAdmin) {
      throw new ForbiddenException(
        'Only institution administrators can view enrollment requests.',
      );
    }

    return this.repository.findPendingEnrollmentRequests(institutionId);
  }

  async reviewEnrollmentRequest(
    institutionId: string,
    targetUserId: string,
    user: AuthenticatedUser,
    decision: ReviewEnrollmentDecision,
  ): Promise<EnrollmentResult> {
    const institution = await this.repository.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institution not found.');
    }

    const isAdmin =
      user.platformRole === 'GLOBAL_ADMIN' ||
      (await this.repository.isInstitutionAdmin(institutionId, user.userId));

    if (!isAdmin) {
      throw new ForbiddenException(
        'Only institution administrators can review enrollment requests.',
      );
    }

    const targetEnrollment = await this.repository.findEnrollment(
      institutionId,
      targetUserId,
    );

    if (!targetEnrollment || targetEnrollment.status !== 'PENDING') {
      throw new NotFoundException(
        'Pending enrollment request not found for this user.',
      );
    }

    const now = new Date();

    if (decision.status === 'APPROVED') {
      await this.repository.upsertEnrollment({
        institutionId,
        userId: targetUserId,
        status: 'ACTIVE',
        enrolledAt: now,
      });

      return {
        success: true,
        enrollmentType: institution.enrollmentType,
        status: 'ACTIVE',
        institutionId,
        userId: targetUserId,
        enrolledAt: now,
        message: 'Enrollment request approved successfully.',
      };
    } else {
      await this.repository.upsertEnrollment({
        institutionId,
        userId: targetUserId,
        status: 'CANCELLED',
        enrolledAt: null,
      });

      return {
        success: true,
        enrollmentType: institution.enrollmentType,
        status: 'CANCELLED',
        institutionId,
        userId: targetUserId,
        enrolledAt: null,
        message: 'Enrollment request rejected.',
      };
    }
  }

  async getInstitution(id: string): Promise<InstitutionEntity> {
    const institution = await this.repository.findById(id);
    if (!institution) {
      throw new NotFoundException('Institution not found.');
    }
    return institution;
  }

  async listInstitutions(
    options: ListInstitutionsOptions,
  ): Promise<InstitutionPage> {
    const { list, total } =
      await this.repository.findActiveInstitutions(options);
    return {
      list,
      total,
      page: options.page,
      limit: options.limit,
    };
  }
}
