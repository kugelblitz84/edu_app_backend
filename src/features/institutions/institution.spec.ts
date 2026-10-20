import { INestApplication, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AccessTokenGuard } from '../../core/auth/guards/access-token.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import type { AccessTokenService } from '../../core/auth/services/access-token.service';
import type { SessionService } from '../../core/auth/services/session.service';
import { InstitutionUseCases } from './domain/institution.usecases';
import { InstitutionController } from './presentation/institution.controllers';

const institutionId = '3bb216fa-38a6-4a3c-bb7d-c2ee47e26140';
const userId = '13c66d9e-42e8-4188-9c10-e2a8d8405587';
const applicantId = '55555555-5555-4555-8555-555555555555';

describe('InstitutionController endpoints', () => {
  let app: INestApplication;
  let server: Server;

  const useCases = {
    enroll: jest.fn(),
    processDummyPayment: jest.fn(),
    getEnrollmentStatus: jest.fn(),
    listPendingEnrollments: jest.fn(),
    reviewEnrollmentRequest: jest.fn(),
    getInstitution: jest.fn(),
    listInstitutions: jest.fn(),
  };

  const tokenService = {
    verify: jest.fn(),
  };

  const sessionService = {
    authenticateAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const authUser = {
      userId,
      sessionId: 'user-session-id',
      platformRole: 'PLATFORM_USER',
      issuedAt: new Date(),
    } as const;

    tokenService.verify.mockResolvedValue(authUser);
    sessionService.authenticateAccessToken.mockImplementation((user) =>
      Promise.resolve(user),
    );

    const module = await Test.createTestingModule({
      controllers: [InstitutionController],
      providers: [{ provide: InstitutionUseCases, useValue: useCases }],
    }).compile();

    app = module.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalGuards(
      new AccessTokenGuard(
        new Reflector(),
        tokenService as unknown as AccessTokenService,
        sessionService as unknown as SessionService,
      ),
      new RolesGuard(new Reflector()),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /v1/institutions/:id/enroll', () => {
    it('requires authentication when header is missing', async () => {
      await request(server)
        .post(`/v1/institutions/${institutionId}/enroll`)
        .send({})
        .expect(401);

      expect(useCases.enroll).not.toHaveBeenCalled();
    });

    it('requires authentication when token is invalid', async () => {
      tokenService.verify.mockRejectedValueOnce(new Error('Invalid token'));

      await request(server)
        .post(`/v1/institutions/${institutionId}/enroll`)
        .set('Authorization', 'Bearer invalid-token')
        .send({})
        .expect(401);

      expect(useCases.enroll).not.toHaveBeenCalled();
    });

    it('rejects invalid uuid', async () => {
      await request(server)
        .post('/v1/institutions/not-a-uuid/enroll')
        .set('Authorization', 'Bearer valid-token')
        .send({})
        .expect(400);
    });

    it('successfully processes FREE enrollment', async () => {
      const enrolledAt = new Date();
      useCases.enroll.mockResolvedValueOnce({
        success: true,
        enrollmentType: 'FREE',
        status: 'ACTIVE',
        institutionId,
        userId,
        enrolledAt,
        message: 'Successfully enrolled in institution.',
      });

      const response = await request(server)
        .post(`/v1/institutions/${institutionId}/enroll`)
        .set('Authorization', 'Bearer valid-token')
        .send({})
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          enrollmentType: 'FREE',
          status: 'ACTIVE',
          institutionId,
          userId,
        }),
      );
      expect(useCases.enroll).toHaveBeenCalledWith(
        institutionId,
        expect.objectContaining({ userId }),
        {},
      );
    });

    it('returns PAYMENT_REQUIRED response for PAID institution without simulation', async () => {
      useCases.enroll.mockResolvedValueOnce({
        success: true,
        enrollmentType: 'PAID',
        status: 'PAYMENT_REQUIRED',
        institutionId,
        userId,
        message: 'Payment required for enrollment.',
        paymentSession: {
          checkoutUrl: `/v1/institutions/${institutionId}/enroll/dummy-pay`,
          sessionId: 'mock_sess_123',
          instructions: 'Call dummy payment endpoint',
        },
      });

      const response = await request(server)
        .post(`/v1/institutions/${institutionId}/enroll`)
        .set('Authorization', 'Bearer valid-token')
        .send({})
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'PAYMENT_REQUIRED',
        paymentSession: {
          checkoutUrl: `/v1/institutions/${institutionId}/enroll/dummy-pay`,
        },
      });
    });

    it('returns PENDING response for INVITE_ONLY institution', async () => {
      useCases.enroll.mockResolvedValueOnce({
        success: true,
        enrollmentType: 'INVITE_ONLY',
        status: 'PENDING',
        institutionId,
        userId,
        requestedAt: new Date(),
        message: 'Enrollment request submitted successfully.',
      });

      const response = await request(server)
        .post(`/v1/institutions/${institutionId}/enroll`)
        .set('Authorization', 'Bearer valid-token')
        .send({})
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'PENDING',
        enrollmentType: 'INVITE_ONLY',
      });
    });
  });

  describe('POST /v1/institutions/:id/enroll/dummy-pay', () => {
    it('successfully completes dummy payment and activates enrollment', async () => {
      const enrolledAt = new Date();
      useCases.processDummyPayment.mockResolvedValueOnce({
        success: true,
        enrollmentType: 'PAID',
        status: 'ACTIVE',
        institutionId,
        userId,
        enrolledAt,
        message: 'Dummy payment processed successfully. You are now enrolled.',
      });

      const response = await request(server)
        .post(`/v1/institutions/${institutionId}/enroll/dummy-pay`)
        .set('Authorization', 'Bearer valid-token')
        .send({ paymentMethod: 'BKASH' })
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'ACTIVE',
        enrollmentType: 'PAID',
      });
      expect(useCases.processDummyPayment).toHaveBeenCalledWith(
        institutionId,
        expect.objectContaining({ userId }),
        { paymentMethod: 'BKASH' },
      );
    });
  });

  describe('GET /v1/institutions/:id/enrollment', () => {
    it('returns current user enrollment status', async () => {
      useCases.getEnrollmentStatus.mockResolvedValueOnce({
        institutionId,
        userId,
        isEnrolled: true,
        status: 'ACTIVE',
        enrolledAt: new Date(),
      });

      const response = await request(server)
        .get(`/v1/institutions/${institutionId}/enrollment`)
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toMatchObject({
        isEnrolled: true,
        status: 'ACTIVE',
      });
    });
  });

  describe('GET /v1/institutions/:id/enrollment-requests', () => {
    it('returns list of pending enrollment requests for admins', async () => {
      useCases.listPendingEnrollments.mockResolvedValueOnce([
        {
          institutionId,
          userId: applicantId,
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: applicantId,
            email: 'applicant@example.com',
            fullName: 'Applicant Name',
            username: 'applicant',
            avatarUrl: null,
          },
        },
      ]);

      const response = await request(server)
        .get(`/v1/institutions/${institutionId}/enrollment-requests`)
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toMatchObject([
        {
          userId: applicantId,
          status: 'PENDING',
        },
      ]);
    });
  });

  describe('PATCH /v1/institutions/:id/enrollment-requests/:userId', () => {
    it('approves an enrollment request', async () => {
      useCases.reviewEnrollmentRequest.mockResolvedValueOnce({
        success: true,
        enrollmentType: 'INVITE_ONLY',
        status: 'ACTIVE',
        institutionId,
        userId: applicantId,
        enrolledAt: new Date(),
        message: 'Enrollment request approved successfully.',
      });

      const response = await request(server)
        .patch(
          `/v1/institutions/${institutionId}/enrollment-requests/${applicantId}`,
        )
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'APPROVED' })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ACTIVE',
      });
      expect(useCases.reviewEnrollmentRequest).toHaveBeenCalledWith(
        institutionId,
        applicantId,
        expect.objectContaining({ userId }),
        { status: 'APPROVED' },
      );
    });
  });

  describe('Public institution browsing endpoints', () => {
    it('allows public access to institution details without token', async () => {
      useCases.getInstitution.mockResolvedValueOnce({
        id: institutionId,
        name: 'Open University',
        slug: 'open-university',
        status: 'ACTIVE',
        institutionCode: 'OU101',
        logoUrl: null,
        description: 'Public University',
        enrollmentType: 'FREE',
        createdByUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(server)
        .get(`/v1/institutions/${institutionId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Open University',
        enrollmentType: 'FREE',
      });
    });

    it('allows public access to list active institutions', async () => {
      useCases.listInstitutions.mockResolvedValueOnce({
        list: [
          {
            id: institutionId,
            name: 'Open University',
            slug: 'open-university',
            status: 'ACTIVE',
            institutionCode: 'OU101',
            logoUrl: null,
            description: 'Public University',
            enrollmentType: 'FREE',
            createdByUserId: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      });

      const response = await request(server)
        .get('/v1/institutions?search=Open')
        .expect(200);

      expect(response.body).toMatchObject({
        total: 1,
        list: [
          {
            id: institutionId,
          },
        ],
      });
    });
  });
});
