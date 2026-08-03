import { Injectable } from '@nestjs/common';
import { Prisma, type PlatformRole, type UserStatus } from '@prisma/client';
import { PrismaService } from '../../../../../core/database/prisma.service';
import {
  CreateUserRecord,
  RegisterUserRepository,
} from '../../domain/contracts/register-user.repository';
import type { RegisteredUser } from '../../domain/entities/registered-user.entity';
import { RegistrationConflictError } from '../../domain/errors/registration.error';

interface UserRecord {
  id: string;
  email: string;
  username: string;
  platformRole: PlatformRole;
  status: UserStatus;
  createdAt: Date;
}

@Injectable()
export class PrismaRegisterUserRepository implements RegisterUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createGuestUser(user: CreateUserRecord): Promise<RegisteredUser> {
    try {
      const createdUser = await this.prisma.user.create({
        data: {
          email: user.email,
          username: user.username,
          passwordHash: user.passwordHash,
          fullName: user.fullName,
        },
        select: {
          id: true,
          email: true,
          username: true,
          platformRole: true,
          status: true,
          createdAt: true,
        },
      });

      return this.toEntity(createdUser);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new RegistrationConflictError();
      }

      throw error;
    }
  }

  private toEntity(row: UserRecord): RegisteredUser {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      platformRole: row.platformRole,
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  private isUniqueViolation(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
