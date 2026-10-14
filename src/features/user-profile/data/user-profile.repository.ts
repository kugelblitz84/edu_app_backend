import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  UsernameConflictError,
  UserProfileRepository,
  type OwnUserProfile,
  type PublicUserProfile,
  type UpdateUserProfile,
} from '../domain/user-profile.contracts';

const ownProfileSelect = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  avatarUrl: true,
} as const;

const publicProfileSelect = {
  username: true,
  fullName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(userId: string): Promise<OwnUserProfile | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: ownProfileSelect,
    });
  }

  findByUsername(username: string): Promise<PublicUserProfile | null> {
    return this.prisma.user.findFirst({
      where: { username, status: 'ACTIVE', deletedAt: null },
      select: publicProfileSelect,
    });
  }

  async update(
    userId: string,
    update: UpdateUserProfile,
  ): Promise<OwnUserProfile | null> {
    try {
      const result = await this.prisma.user.updateMany({
        where: { id: userId, status: 'ACTIVE', deletedAt: null },
        data: update,
      });
      if (result.count === 0) return null;

      return this.prisma.user.findUnique({
        where: { id: userId },
        select: ownProfileSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target;
        const fields = Array.isArray(target)
          ? target.map(String)
          : [String(target)];
        if (fields.some((field) => field.includes('username'))) {
          throw new UsernameConflictError();
        }
      }
      throw error;
    }
  }
}
