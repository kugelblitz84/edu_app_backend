import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  InstitutionRepository,
  type EnrollmentEntity,
  type EnrollmentStatus,
  type InstitutionEntity,
  type ListInstitutionsOptions,
  type PendingEnrollmentRequest,
} from '../domain/institution.contracts';

@Injectable()
export class PrismaInstitutionRepository implements InstitutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<InstitutionEntity | null> {
    return this.prisma.institution.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<InstitutionEntity | null> {
    return this.prisma.institution.findUnique({
      where: { slug },
    });
  }

  async findEnrollment(
    institutionId: string,
    userId: string,
  ): Promise<EnrollmentEntity | null> {
    return this.prisma.enrollment.findUnique({
      where: {
        institutionId_userId: {
          institutionId,
          userId,
        },
      },
    });
  }

  async upsertEnrollment(data: {
    institutionId: string;
    userId: string;
    status: EnrollmentStatus;
    enrolledAt?: Date | null;
    expiresAt?: Date | null;
  }): Promise<EnrollmentEntity> {
    return this.prisma.enrollment.upsert({
      where: {
        institutionId_userId: {
          institutionId: data.institutionId,
          userId: data.userId,
        },
      },
      create: {
        institutionId: data.institutionId,
        userId: data.userId,
        status: data.status,
        enrolledAt: data.enrolledAt ?? null,
        expiresAt: data.expiresAt ?? null,
      },
      update: {
        status: data.status,
        enrolledAt: data.enrolledAt !== undefined ? data.enrolledAt : undefined,
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      },
    });
  }

  async isInstitutionAdmin(
    institutionId: string,
    userId: string,
  ): Promise<boolean> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { createdByUserId: true },
    });

    if (institution?.createdByUserId === userId) {
      return true;
    }

    const admin = await this.prisma.institutionAdmin.findUnique({
      where: {
        institutionId_userId: {
          institutionId,
          userId,
        },
      },
    });

    return !!admin;
  }

  async findPendingEnrollmentRequests(
    institutionId: string,
  ): Promise<PendingEnrollmentRequest[]> {
    const rows = await this.prisma.enrollment.findMany({
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

    return rows.map((row) => ({
      institutionId: row.institutionId,
      userId: row.userId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: row.user,
    }));
  }

  async findActiveInstitutions(
    options: ListInstitutionsOptions,
  ): Promise<{ list: InstitutionEntity[]; total: number }> {
    const where: Prisma.InstitutionWhereInput = {
      status: 'ACTIVE',
      ...(options.search
        ? {
            name: {
              contains: options.search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [list, total] = await this.prisma.$transaction([
      this.prisma.institution.findMany({
        where,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.institution.count({ where }),
    ]);

    return { list, total };
  }
}

