import type {
  InstitutionReview,
  ReviewDecision,
} from '../domain/contracts/types';
import { PrismaGlobalAdminRepository } from './repository.inpl';

const institutionId = '3bb216fa-38a6-4a3c-bb7d-c2ee47e26140';
const creatorId = '779b28f9-53c0-4010-a743-ffbc97853a1d';
const reviewerId = '13c66d9e-42e8-4188-9c10-e2a8d8405587';
const respondedAt = new Date('2026-09-21T00:00:00.000Z');

function review(overrides: Partial<InstitutionReview> = {}): InstitutionReview {
  return {
    id: institutionId,
    name: 'Dhaka Learning Academy',
    logoUrl: null,
    createdByUserId: creatorId,
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

function decision(overrides: Partial<ReviewDecision> = {}): ReviewDecision {
  return {
    verdict: 'APPROVED',
    respondedByUserId: reviewerId,
    respondedAt,
    institutionCode: 'INS-1234567890ABCDEF',
    ...overrides,
  };
}

describe('PrismaGlobalAdminRepository', () => {
  const tx = {
    institution: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
    },
    institutionAdmin: {
      upsert: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
  const repository = new PrismaGlobalAdminRepository(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('atomically makes the creator an admin when approval succeeds', async () => {
    const approved = review({
      status: 'ACTIVE',
      reviewVerdict: 'APPROVED',
      respondedByUserId: reviewerId,
      respondedAt,
      institutionCode: 'INS-1234567890ABCDEF',
    });
    tx.institution.updateMany.mockResolvedValue({ count: 1 });
    tx.institution.findUniqueOrThrow.mockResolvedValue({
      createdByUserId: creatorId,
    });
    tx.institutionAdmin.upsert.mockResolvedValue({
      institutionId,
      userId: creatorId,
    });
    tx.institution.findUnique.mockResolvedValue(approved);

    await expect(
      repository.respondToPending(institutionId, decision()),
    ).resolves.toEqual(approved);

    expect(tx.institutionAdmin.upsert).toHaveBeenCalledWith({
      where: {
        institutionId_userId: {
          institutionId,
          userId: creatorId,
        },
      },
      create: { institutionId, userId: creatorId },
      update: {},
    });
  });

  it('does not create an institution admin when rejecting', async () => {
    const rejected = review({
      status: 'REJECTED',
      reviewVerdict: 'REJECTED',
      respondedByUserId: reviewerId,
      respondedAt,
      rejectReason: 'Incomplete application',
    });
    tx.institution.updateMany.mockResolvedValue({ count: 1 });
    tx.institution.findUnique.mockResolvedValue(rejected);

    await expect(
      repository.respondToPending(
        institutionId,
        decision({
          verdict: 'REJECTED',
          institutionCode: undefined,
          rejectReason: 'Incomplete application',
        }),
      ),
    ).resolves.toEqual(rejected);

    expect(tx.institutionAdmin.upsert).not.toHaveBeenCalled();
    expect(tx.institution.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('does not assign an admin when the institution is no longer pending', async () => {
    tx.institution.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.respondToPending(institutionId, decision()),
    ).resolves.toBeNull();

    expect(tx.institutionAdmin.upsert).not.toHaveBeenCalled();
    expect(tx.institution.findUnique).not.toHaveBeenCalled();
  });
});
