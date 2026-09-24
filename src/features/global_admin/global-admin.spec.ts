import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { AccessTokenGuard } from '../../core/auth/guards/access-token.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import type { AccessTokenService } from '../../core/auth/services/access-token.service';
import type { InstitutionReview } from './domain/contracts/types';
import { InstitutionCodeConflictError } from './domain/contracts/services';
import { GlobalAdminUseCases } from './domain/usecases';
import { GlobalAdminController } from './presentation/global-admin.controller';

const institutionId = '3bb216fa-38a6-4a3c-bb7d-c2ee47e26140';
const adminId = '13c66d9e-42e8-4188-9c10-e2a8d8405587';

function review(overrides: Partial<InstitutionReview> = {}): InstitutionReview {
  return {
    id: institutionId,
    name: 'Dhaka Learning Academy',
    logoUrl: null,
    createdByUserId: '779b28f9-53c0-4010-a743-ffbc97853a1d',
    createdAt: new Date('2026-09-15T00:00:00.000Z'),
    status: 'PENDING_APPROVAL',
    institutionCode: null,
    reviewVerdict: null,
    respondedByUserId: null,
    respondedAt: null,
    rejectReason: null,
    reviewNotes: null,
    ...overrides,
  };
}

describe('global-admin endpoints', () => {
  let app: INestApplication;
  let server: Server;
  const useCases = {
    getPending: jest.fn(),
    getRespondedBy: jest.fn(),
    respond: jest.fn(),
  };
  const tokenService = {
    verify: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    tokenService.verify.mockReturnValue({
      userId: adminId,
      platformRole: 'GLOBAL_ADMIN',
      issuedAt: new Date(),
    });

    const module = await Test.createTestingModule({
      controllers: [GlobalAdminController],
      providers: [{ provide: GlobalAdminUseCases, useValue: useCases }],
    }).compile();

    app = module.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalGuards(
      new AccessTokenGuard(
        new Reflector(),
        tokenService as unknown as AccessTokenService,
      ),
      new RolesGuard(new Reflector()),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  it('forbids authenticated users without the global admin role', async () => {
    tokenService.verify.mockReturnValueOnce({
      userId: adminId,
      platformRole: 'PLATFORM_USER',
      issuedAt: new Date(),
    });

    await request(server)
      .get('/v1/global-admin/institutions/pending')
      .set('Authorization', 'Bearer guest-token')
      .expect(403);

    expect(useCases.getPending).not.toHaveBeenCalled();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists pending requests with pagination and search', async () => {
    useCases.getPending.mockResolvedValue({ list: [review()], total: 1 });

    const response = await request(server)
      .get(
        '/v1/global-admin/institutions/pending?page=2&limit=5&search=Dhaka&sortBy=name&sortOrder=asc',
      )
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(useCases.getPending).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
      search: 'Dhaka',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(response.body).toMatchObject({
      page: 2,
      limit: 5,
      total: 1,
      list: [
        {
          id: institutionId,
          requestedByUserId: '779b28f9-53c0-4010-a743-ffbc97853a1d',
        },
      ],
    });
  });

  it('lists only decisions made by the authenticated admin', async () => {
    useCases.getRespondedBy.mockResolvedValue({
      list: [
        review({
          status: 'REJECTED',
          reviewVerdict: 'REJECTED',
          respondedByUserId: adminId,
          respondedAt: new Date('2026-09-16T00:00:00.000Z'),
          rejectReason: 'Incomplete application',
        }),
      ],
      total: 1,
    });

    const response = await request(server)
      .get('/v1/global-admin/institutions/responded-by-me')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(useCases.getRespondedBy).toHaveBeenCalledWith(adminId, {
      page: 1,
      limit: 20,
      sortBy: 'respondedAt',
      sortOrder: 'desc',
    });
    expect((response.body as { list: unknown[] }).list[0]).toMatchObject({
      verdict: 'REJECTED',
      rejectReason: 'Incomplete application',
    });
  });

  it('approves an institution using the authenticated admin identity', async () => {
    useCases.respond.mockResolvedValue(
      review({
        status: 'ACTIVE',
        reviewVerdict: 'APPROVED',
        institutionCode: 'INS-1234567890ABCDEF',
        respondedByUserId: adminId,
        respondedAt: new Date('2026-09-16T00:00:00.000Z'),
      }),
    );

    const response = await request(server)
      .patch(`/v1/global-admin/institutions/${institutionId}/respond`)
      .set('Authorization', 'Bearer admin-token')
      .send({ status: 'APPROVED' })
      .expect(200);

    expect(useCases.respond).toHaveBeenCalledWith(institutionId, adminId, {
      verdict: 'APPROVED',
      rejectReason: undefined,
      notes: undefined,
    });
    expect(response.body).toMatchObject({
      verdict: 'APPROVED',
      status: 'ACTIVE',
      institutionCode: 'INS-1234567890ABCDEF',
    });
  });

  it('rejects an institution with a reason and optional notes', async () => {
    useCases.respond.mockResolvedValue(
      review({
        status: 'REJECTED',
        reviewVerdict: 'REJECTED',
        respondedByUserId: adminId,
        respondedAt: new Date('2026-09-16T00:00:00.000Z'),
        rejectReason: 'Incomplete application',
        reviewNotes: 'Ask for documents',
      }),
    );

    await request(server)
      .patch(`/v1/global-admin/institutions/${institutionId}/respond`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        status: 'REJECTED',
        rejectReason: 'Incomplete application',
        notes: 'Ask for documents',
      })
      .expect(200);

    expect(useCases.respond).toHaveBeenCalledWith(institutionId, adminId, {
      verdict: 'REJECTED',
      rejectReason: 'Incomplete application',
      notes: 'Ask for documents',
    });
  });

  it('rejects invalid decisions and unauthenticated requests', async () => {
    await request(server)
      .patch(`/v1/global-admin/institutions/${institutionId}/respond`)
      .set('Authorization', 'Bearer admin-token')
      .send({ status: 'REJECTED' })
      .expect(400);

    await request(server)
      .get('/v1/global-admin/institutions/pending')
      .expect(401);

    expect(useCases.respond).not.toHaveBeenCalled();
  });
});

describe('GlobalAdminUseCases', () => {
  const repository = {
    findPending: jest.fn(),
    findRespondedBy: jest.fn(),
    findById: jest.fn(),
    respondToPending: jest.fn(),
  };
  const codeGenerator = { generate: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assigns a generated code only when approving', async () => {
    codeGenerator.generate.mockReturnValue('INS-1234567890ABCDEF');
    repository.respondToPending.mockResolvedValue(
      review({
        status: 'ACTIVE',
        reviewVerdict: 'APPROVED',
        institutionCode: 'INS-1234567890ABCDEF',
      }),
    );
    const useCases = new GlobalAdminUseCases(repository, codeGenerator);

    await useCases.respond(institutionId, adminId, { verdict: 'APPROVED' });

    expect(repository.respondToPending).toHaveBeenCalledWith(
      institutionId,
      expect.objectContaining({
        verdict: 'APPROVED',
        respondedByUserId: adminId,
        institutionCode: 'INS-1234567890ABCDEF',
      }),
    );
  });

  it('records a rejection without allocating a code', async () => {
    repository.respondToPending.mockResolvedValue(
      review({ status: 'REJECTED', reviewVerdict: 'REJECTED' }),
    );
    const useCases = new GlobalAdminUseCases(repository, codeGenerator);

    await useCases.respond(institutionId, adminId, {
      verdict: 'REJECTED',
      rejectReason: 'Incomplete application',
    });

    expect(codeGenerator.generate).not.toHaveBeenCalled();
    expect(repository.respondToPending).toHaveBeenCalledWith(
      institutionId,
      expect.objectContaining({
        verdict: 'REJECTED',
        institutionCode: undefined,
        rejectReason: 'Incomplete application',
      }),
    );
  });

  it('retries a generated code collision', async () => {
    codeGenerator.generate
      .mockReturnValueOnce('INS-1234567890ABCDEF')
      .mockReturnValueOnce('INS-FEDCBA0987654321');
    repository.respondToPending
      .mockRejectedValueOnce(new InstitutionCodeConflictError())
      .mockResolvedValueOnce(
        review({
          status: 'ACTIVE',
          reviewVerdict: 'APPROVED',
          institutionCode: 'INS-FEDCBA0987654321',
        }),
      );
    const useCases = new GlobalAdminUseCases(repository, codeGenerator);

    const result = await useCases.respond(institutionId, adminId, {
      verdict: 'APPROVED',
    });

    expect(result.institutionCode).toBe('INS-FEDCBA0987654321');
    expect(repository.respondToPending).toHaveBeenCalledTimes(2);
  });
});
