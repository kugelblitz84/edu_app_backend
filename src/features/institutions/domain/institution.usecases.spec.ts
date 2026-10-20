import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { InstitutionUseCases } from './institution.usecases';
import type {
  EnrollmentEntity,
  InstitutionEntity,
  PendingEnrollmentRequest,
} from './institution.contracts';

const mockUser: AuthenticatedUser = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'test-session',
  platformRole: 'PLATFORM_USER',
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000),
};

const mockAdminUser: AuthenticatedUser = {
  userId: '22222222-2222-4222-8222-222222222222',
  sessionId: 'admin-session',
  platformRole: 'PLATFORM_USER',
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000),
};

const mockGlobalAdmin: AuthenticatedUser = {
  userId: '33333333-3333-4333-8333-333333333333',
  sessionId: 'global-admin-session',
  platformRole: 'GLOBAL_ADMIN',
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000),
};

function createInstitution(
  overrides: Partial<InstitutionEntity> = {},
): InstitutionEntity {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Test University',
    slug: 'test-university',
    status: 'ACTIVE',
    institutionCode: 'TU100',
    logoUrl: null,
    description: 'A great university',
    enrollmentType: 'FREE',
    createdByUserId: mockAdminUser.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('InstitutionUseCases', () => {
  let useCases: InstitutionUseCases;
  let repository: {
    findById: jest.Mock;
    findBySlug: jest.Mock;
    findEnrollment: jest.Mock;
    upsertEnrollment: jest.Mock;
    isInstitutionAdmin: jest.Mock;
    findPendingEnrollmentRequests: jest.Mock;
    findActiveInstitutions: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findEnrollment: jest.fn(),
      upsertEnrollment: jest.fn(),
      isInstitutionAdmin: jest.fn(),
      findPendingEnrollmentRequests: jest.fn(),
      findActiveInstitutions: jest.fn(),
    };
    useCases = new InstitutionUseCases(repository);
  });

  describe('enroll - FREE enrollment', () => {
    it('successfully creates an active enrollment record immediately for FREE institutions', async () => {
      const institution = createInstitution({ enrollmentType: 'FREE' });
      repository.findById.mockResolvedValue(institution);
      repository.findEnrollment.mockResolvedValue(null);
      repository.upsertEnrollment.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as EnrollmentEntity),
      );

      const result = await useCases.enroll(institution.id, mockUser);

      expect(result.success).toBe(true);
      expect(result.enrollmentType).toBe('FREE');
      expect(result.status).toBe('ACTIVE');
      expect(result.enrolledAt).toBeInstanceOf(Date);
      expect(repository.upsertEnrollment).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: institution.id,
          userId: mockUser.userId,
          status: 'ACTIVE',
        }),
      );
    });

    it('rejects enrollment if the user is already actively enrolled', async () => {
      const institution = createInstitution({ enrollmentType: 'FREE' });
      repository.findById.mockResolvedValue(institution);
      repository.findEnrollment.mockResolvedValue({
        institutionId: institution.id,
        userId: mockUser.userId,
        status: 'ACTIVE',
        enrolledAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(useCases.enroll(institution.id, mockUser)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.upsertEnrollment).not.toHaveBeenCalled();
    });

    it('rejects enrollment if an enrollment request is already pending', async () => {
      const institution = createInstitution({ enrollmentType: 'FREE' });
      repository.findById.mockResolvedValue(institution);
      repository.findEnrollment.mockResolvedValue({
        institutionId: institution.id,
        userId: mockUser.userId,
        status: 'PENDING',
        enrolledAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(useCases.enroll(institution.id, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects enrollment if the user status is suspended', async () => {
      const institution = createInstitution({ enrollmentType: 'FREE' });
      repository.findById.mockResolvedValue(institution);
      repository.findEnrollment.mockResolvedValue({
        institutionId: institution.id,
        userId: mockUser.userId,
        status: 'SUSPENDED',
        enrolledAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(useCases.enroll(institution.id, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException if institution does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        useCases.enroll('non-existent-id', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if institution is not ACTIVE', async () => {
      const institution = createInstitution({ status: 'PENDING_APPROVAL' });
      repository.findById.mockResolvedValue(institution);

      await expect(useCases.enroll(institution.id, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('enroll - PAID enrollment (dummy endpoint)', () => {
    it('returns dummy checkout payment session info when enrolling in a PAID institution without simulation flag', async () => {
      const institution = createInstitution({ enrollmentType: 'PAID' });
      repository.findById.mockResolvedValue(institution);
      repository.findEnrollment.mockResolvedValue(null);

      const result = await useCases.enroll(institution.id, mockUser);

      expect(result.success).toBe(true);
      expect(result.enrollmentType).toBe('PAID');
      expect(result.status).toBe('PAYMENT_REQUIRED');
      expect(result.paymentSession).toBeDefined();
      expect(result.paymentSession?.checkoutUrl).toContain(
        `/v1/institutions/${institution.id}/enroll/dummy-pay`,
      );
      expect(repository.upsertEnrollment).not.toHaveBeenCalled();
    });

    it('completes enrollment when simulatePayment is provided in request body', async () => {
      const institution = createInstitution({ enrollmentType: 'PAID' });
      repository.findById.mockResolvedValue(institution);
      repository.findEnrollment.mockResolvedValue(null);
      repository.upsertEnrollment.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as EnrollmentEntity),
      );

      const result = await useCases.enroll(institution.id, mockUser, {
        simulatePayment: true,
      });

      expect(result.success).toBe(true);
      expect(result.enrollmentType).toBe('PAID');
      expect(result.status).toBe('ACTIVE');
      expect(result.enrolledAt).toBeInstanceOf(Date);
      expect(repository.upsertEnrollment).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: institution.id,
          userId: mockUser.userId,
          status: 'ACTIVE',
        }),
      );
    });

    it('processes dummy payment via dedicated processDummyPayment endpoint', async () => {
      const institution = createInstitution({ enrollmentType: 'PAID' });
      repository.findById.mockResolvedValue(institution);
      repository.findEnrollment.mockResolvedValue(null);
      repository.upsertEnrollment.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as EnrollmentEntity),
      );

      const result = await useCases.processDummyPayment(
        institution.id,
        mockUser,
        {
          paymentMethod: 'CREDIT_CARD',
          transactionReference: 'TX-12345',
        },
      );

      expect(result.success).toBe(true);
      expect(result.enrollmentType).toBe('PAID');
      expect(result.status).toBe('ACTIVE');
      expect(result.enrolledAt).toBeInstanceOf(Date);
      expect(repository.upsertEnrollment).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: institution.id,
          userId: mockUser.userId,
          status: 'ACTIVE',
        }),
      );
    });

    it('rejects dummy payment endpoint if institution is not PAID type', async () => {
      const institution = createInstitution({ enrollmentType: 'FREE' });
      repository.findById.mockResolvedValue(institution);

      await expect(
        useCases.processDummyPayment(institution.id, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('enroll - INVITE_ONLY enrollment', () => {
    it('creates a PENDING enrollment request for admin approval', async () => {
      const institution = createInstitution({ enrollmentType: 'INVITE_ONLY' });
      repository.findById.mockResolvedValue(institution);
      repository.findEnrollment.mockResolvedValue(null);
      repository.upsertEnrollment.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as EnrollmentEntity),
      );

      const result = await useCases.enroll(institution.id, mockUser);

      expect(result.success).toBe(true);
      expect(result.enrollmentType).toBe('INVITE_ONLY');
      expect(result.status).toBe('PENDING');
      expect(result.enrolledAt).toBeUndefined();
      expect(result.requestedAt).toBeInstanceOf(Date);
      expect(repository.upsertEnrollment).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: institution.id,
          userId: mockUser.userId,
          status: 'PENDING',
          enrolledAt: null,
        }),
      );
    });
  });

  describe('Admin actions - pending requests & review', () => {
    it('allows an institution admin to list pending enrollment requests', async () => {
      const institution = createInstitution({ enrollmentType: 'INVITE_ONLY' });
      repository.findById.mockResolvedValue(institution);
      repository.isInstitutionAdmin.mockResolvedValue(true);

      const mockRequests: PendingEnrollmentRequest[] = [
        {
          institutionId: institution.id,
          userId: mockUser.userId,
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: mockUser.userId,
            email: 'user@example.com',
            fullName: 'Test User',
            username: 'testuser',
            avatarUrl: null,
          },
        },
      ];
      repository.findPendingEnrollmentRequests.mockResolvedValue(mockRequests);

      const result = await useCases.listPendingEnrollments(
        institution.id,
        mockAdminUser,
      );

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(mockUser.userId);
    });

    it('allows a global admin to list pending enrollment requests', async () => {
      const institution = createInstitution({ enrollmentType: 'INVITE_ONLY' });
      repository.findById.mockResolvedValue(institution);
      repository.findPendingEnrollmentRequests.mockResolvedValue([]);

      const result = await useCases.listPendingEnrollments(
        institution.id,
        mockGlobalAdmin,
      );

      expect(result).toEqual([]);
    });

    it('forbids non-admins from listing enrollment requests', async () => {
      const institution = createInstitution({ enrollmentType: 'INVITE_ONLY' });
      repository.findById.mockResolvedValue(institution);
      repository.isInstitutionAdmin.mockResolvedValue(false);

      await expect(
        useCases.listPendingEnrollments(institution.id, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to approve a pending enrollment request', async () => {
      const institution = createInstitution({ enrollmentType: 'INVITE_ONLY' });
      repository.findById.mockResolvedValue(institution);
      repository.isInstitutionAdmin.mockResolvedValue(true);
      repository.findEnrollment.mockResolvedValue({
        institutionId: institution.id,
        userId: mockUser.userId,
        status: 'PENDING',
        enrolledAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repository.upsertEnrollment.mockImplementation((data) =>
        Promise.resolve({
          ...data,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as EnrollmentEntity),
      );

      const result = await useCases.reviewEnrollmentRequest(
        institution.id,
        mockUser.userId,
        mockAdminUser,
        { status: 'APPROVED' },
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('ACTIVE');
      expect(result.enrolledAt).toBeInstanceOf(Date);
      expect(repository.upsertEnrollment).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: institution.id,
          userId: mockUser.userId,
          status: 'ACTIVE',
        }),
      );
    });

    it('allows admin to reject a pending enrollment request', async () => {
      const institution = createInstitution({ enrollmentType: 'INVITE_ONLY' });
      repository.findById.mockResolvedValue(institution);
      repository.isInstitutionAdmin.mockResolvedValue(true);
      repository.findEnrollment.mockResolvedValue({
        institutionId: institution.id,
        userId: mockUser.userId,
        status: 'PENDING',
        enrolledAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await useCases.reviewEnrollmentRequest(
        institution.id,
        mockUser.userId,
        mockAdminUser,
        { status: 'REJECTED' },
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('CANCELLED');
      expect(repository.upsertEnrollment).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: institution.id,
          userId: mockUser.userId,
          status: 'CANCELLED',
        }),
      );
    });

    it('throws NotFoundException when reviewing non-existent or non-pending enrollment', async () => {
      const institution = createInstitution({ enrollmentType: 'INVITE_ONLY' });
      repository.findById.mockResolvedValue(institution);
      repository.isInstitutionAdmin.mockResolvedValue(true);
      repository.findEnrollment.mockResolvedValue(null);

      await expect(
        useCases.reviewEnrollmentRequest(
          institution.id,
          mockUser.userId,
          mockAdminUser,
          { status: 'APPROVED' },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEnrollmentStatus', () => {
    it('returns enrolled true when user has ACTIVE status', async () => {
      const institution = createInstitution();
      repository.findById.mockResolvedValue(institution);
      repository.findEnrollment.mockResolvedValue({
        institutionId: institution.id,
        userId: mockUser.userId,
        status: 'ACTIVE',
        enrolledAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const status = await useCases.getEnrollmentStatus(
        institution.id,
        mockUser.userId,
      );

      expect(status.isEnrolled).toBe(true);
      expect(status.status).toBe('ACTIVE');
    });

    it('returns enrolled false when user has no record', async () => {
      const institution = createInstitution();
      repository.findById.mockResolvedValue(institution);
      repository.findEnrollment.mockResolvedValue(null);

      const status = await useCases.getEnrollmentStatus(
        institution.id,
        mockUser.userId,
      );

      expect(status.isEnrolled).toBe(false);
      expect(status.status).toBeNull();
    });
  });
});
