import { PrismaInstitutionRepository } from './institution.repository';
import type { PrismaService } from '../../../core/database/prisma.service';

const institutionId = '3bb216fa-38a6-4a3c-bb7d-c2ee47e26140';
const userId = '13c66d9e-42e8-4188-9c10-e2a8d8405587';
const adminId = '779b28f9-53c0-4010-a743-ffbc97853a1d';

describe('PrismaInstitutionRepository', () => {
  let repository: PrismaInstitutionRepository;
  let prisma: {
    institution: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    enrollment: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      findMany: jest.Mock;
    };
    institutionAdmin: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      institution: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      enrollment: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      institutionAdmin: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    repository = new PrismaInstitutionRepository(
      prisma as unknown as PrismaService,
    );
  });

  describe('findById and findBySlug', () => {
    it('finds institution by id', async () => {
      const mockInst = { id: institutionId, name: 'Inst 1' };
      prisma.institution.findUnique.mockResolvedValue(mockInst);

      const result = await repository.findById(institutionId);
      expect(result).toBe(mockInst);
      expect(prisma.institution.findUnique).toHaveBeenCalledWith({
        where: { id: institutionId },
      });
    });

    it('finds institution by slug', async () => {
      const mockInst = { id: institutionId, slug: 'inst-1' };
      prisma.institution.findUnique.mockResolvedValue(mockInst);

      const result = await repository.findBySlug('inst-1');
      expect(result).toBe(mockInst);
      expect(prisma.institution.findUnique).toHaveBeenCalledWith({
        where: { slug: 'inst-1' },
      });
    });
  });

  describe('findEnrollment and upsertEnrollment', () => {
    it('finds enrollment by compound key', async () => {
      const mockEnrollment = {
        institutionId,
        userId,
        status: 'ACTIVE',
      };
      prisma.enrollment.findUnique.mockResolvedValue(mockEnrollment);

      const result = await repository.findEnrollment(institutionId, userId);
      expect(result).toBe(mockEnrollment);
      expect(prisma.enrollment.findUnique).toHaveBeenCalledWith({
        where: {
          institutionId_userId: {
            institutionId,
            userId,
          },
        },
      });
    });

    it('upserts enrollment record', async () => {
      const now = new Date();
      const mockEnrollment = {
        institutionId,
        userId,
        status: 'ACTIVE',
        enrolledAt: now,
      };
      prisma.enrollment.upsert.mockResolvedValue(mockEnrollment);

      const result = await repository.upsertEnrollment({
        institutionId,
        userId,
        status: 'ACTIVE',
        enrolledAt: now,
      });

      expect(result).toBe(mockEnrollment);
      expect(prisma.enrollment.upsert).toHaveBeenCalledWith({
        where: {
          institutionId_userId: {
            institutionId,
            userId,
          },
        },
        create: {
          institutionId,
          userId,
          status: 'ACTIVE',
          enrolledAt: now,
          expiresAt: null,
        },
        update: {
          status: 'ACTIVE',
          enrolledAt: now,
        },
      });
    });
  });

  describe('isInstitutionAdmin', () => {
    it('returns true if user is the creator of the institution', async () => {
      prisma.institution.findUnique.mockResolvedValue({
        createdByUserId: adminId,
      });

      const isAdmin = await repository.isInstitutionAdmin(
        institutionId,
        adminId,
      );
      expect(isAdmin).toBe(true);
      expect(prisma.institutionAdmin.findUnique).not.toHaveBeenCalled();
    });

    it('returns true if user has an institution admin record', async () => {
      prisma.institution.findUnique.mockResolvedValue({
        createdByUserId: 'other-user',
      });
      prisma.institutionAdmin.findUnique.mockResolvedValue({
        institutionId,
        userId: adminId,
      });

      const isAdmin = await repository.isInstitutionAdmin(
        institutionId,
        adminId,
      );
      expect(isAdmin).toBe(true);
    });

    it('returns false if user is neither creator nor institution admin', async () => {
      prisma.institution.findUnique.mockResolvedValue({
        createdByUserId: 'other-user',
      });
      prisma.institutionAdmin.findUnique.mockResolvedValue(null);

      const isAdmin = await repository.isInstitutionAdmin(
        institutionId,
        adminId,
      );
      expect(isAdmin).toBe(false);
    });
  });

  describe('findPendingEnrollmentRequests', () => {
    it('retrieves pending enrollment requests with user profiles', async () => {
      const mockRows = [
        {
          institutionId,
          userId,
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: userId,
            email: 'test@example.com',
            fullName: 'Test User',
            username: 'testuser',
            avatarUrl: null,
          },
        },
      ];
      prisma.enrollment.findMany.mockResolvedValue(mockRows);

      const result =
        await repository.findPendingEnrollmentRequests(institutionId);
      expect(result).toHaveLength(1);
      expect(result[0].user.email).toBe('test@example.com');
      expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
        where: {
          institutionId,
          status: 'PENDING',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });
  });

  describe('findActiveInstitutions', () => {
    it('retrieves paginated active institutions with search', async () => {
      const mockList = [{ id: institutionId, name: 'Active College' }];
      prisma.$transaction.mockResolvedValue([mockList, 1]);

      const result = await repository.findActiveInstitutions({
        page: 1,
        limit: 10,
        search: 'College',
      });

      expect(result.list).toEqual(mockList);
      expect(result.total).toBe(1);
    });
  });
});
