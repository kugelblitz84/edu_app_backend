import { Injectable } from '@nestjs/common';
import { Prisma, type InstitutionStatus } from '@prisma/client';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { RegisterInstitutionRepository } from '../../domain/contracts/register-institution.repository';
import type { CreateInstitutionRecord } from '../../domain/contracts/types';
import type { RegisteredInstitution } from '../../domain/entities/registered-institution.entity';
import { InstitutionRegistrationConflictError } from '../../domain/errors/registration.error';

interface InstitutionRecord {
  id: string;
  name: string;
  slug: string;
  institutionCode: string | null;
  logoUrl: string | null;
  description: string | null;
  status: InstitutionStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

@Injectable()
export class PrismaRegisterInstitutionRepository implements RegisterInstitutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createInstitution(
    institution: CreateInstitutionRecord,
  ): Promise<RegisteredInstitution> {
    try {
      const createdInstitution = await this.prisma.institution.create({
        data: institution,
        select: {
          id: true,
          name: true,
          slug: true,
          institutionCode: true,
          logoUrl: true,
          description: true,
          status: true,
          createdByUserId: true,
          createdAt: true,
          updatedAt: true,
          archivedAt: true,
        },
      });

      return this.toEntity(createdInstitution);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new InstitutionRegistrationConflictError();
      }

      throw error;
    }
  }

  private toEntity(row: InstitutionRecord): RegisteredInstitution {
    return row;
  }
}
