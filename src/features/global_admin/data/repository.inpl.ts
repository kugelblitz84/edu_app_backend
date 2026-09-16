import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  GlobalAdminRepository,
  type InstitutionReview,
  type ReviewDecision,
  type ReviewPage,
  type ReviewPageOptions,
} from '../domain/contracts/repositories';
import { InstitutionCodeConflictError } from '../domain/contracts/services';

const reviewSelect = {
  id: true,
  name: true,
  logoUrl: true,
  createdByUserId: true,
  createdAt: true,
  status: true,
  institutionCode: true,
  reviewVerdict: true,
  respondedByUserId: true,
  respondedAt: true,
  rejectReason: true,
  reviewNotes: true,
} as const;

@Injectable()
export class PrismaGlobalAdminRepository implements GlobalAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPending(options: ReviewPageOptions): Promise<ReviewPage> {
    return this.findPage({ status: 'PENDING_APPROVAL' }, options);
  }

  findRespondedBy(
    userId: string,
    options: ReviewPageOptions,
  ): Promise<ReviewPage> {
    return this.findPage(
      { respondedByUserId: userId, reviewVerdict: { not: null } },
      options,
    );
  }

  async findById(id: string): Promise<InstitutionReview | null> {
    return this.prisma.institution.findUnique({
      where: { id },
      select: reviewSelect,
    });
  }

  async respondToPending(
    id: string,
    decision: ReviewDecision,
  ): Promise<InstitutionReview | null> {
    try {
      const result = await this.prisma.institution.updateMany({
        where: { id, status: 'PENDING_APPROVAL' },
        data: {
          status: decision.verdict === 'APPROVED' ? 'ACTIVE' : 'REJECTED',
          reviewVerdict: decision.verdict,
          respondedByUserId: decision.respondedByUserId,
          respondedAt: decision.respondedAt,
          institutionCode: decision.institutionCode ?? null,
          rejectReason: decision.rejectReason ?? null,
          reviewNotes: decision.notes ?? null,
        },
      });

      if (result.count === 0) return null;
      return this.findById(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new InstitutionCodeConflictError();
      }
      throw error;
    }
  }

  private async findPage(
    baseWhere: Prisma.InstitutionWhereInput,
    options: ReviewPageOptions,
  ): Promise<ReviewPage> {
    const where: Prisma.InstitutionWhereInput = {
      ...baseWhere,
      ...(options.search
        ? { name: { contains: options.search, mode: 'insensitive' } }
        : {}),
    };
    const [list, total] = await this.prisma.$transaction([
      this.prisma.institution.findMany({
        where,
        select: reviewSelect,
        orderBy: [{ [options.sortBy]: options.sortOrder }, { id: 'asc' }],
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.institution.count({ where }),
    ]);

    return { list, total };
  }
}
