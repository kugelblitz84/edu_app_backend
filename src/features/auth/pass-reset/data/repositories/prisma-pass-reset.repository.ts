import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../core/database/prisma.service';
import {
  PassResetRepository,
  type PasswordResetRecord,
  type PasswordResetUser,
} from '../../domain/contracts/pass-reset.repository';

const userSelection = {
  id: true,
  email: true,
  passwordHash: true,
  status: true,
  lastLoginIp: true,
  lastLoginRegion: true,
  passwordChangedAt: true,
} as const;

@Injectable()
export class PrismaPassResetRepository implements PassResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<PasswordResetUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: userSelection,
    });
  }

  findUserById(userId: string): Promise<PasswordResetUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelection,
    });
  }

  async replaceActiveReset(
    userId: string,
    tokenDigest: string,
    expiresAt: Date,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.passwordReset.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: now },
      });
      await transaction.passwordReset.create({
        data: { userId, codeDigest: tokenDigest, expiresAt },
        select: { id: true },
      });
    });
  }

  findResetByDigest(tokenDigest: string): Promise<PasswordResetRecord | null> {
    return this.prisma.passwordReset.findUnique({
      where: { codeDigest: tokenDigest },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
  }

  async consumeResetAndChangePassword(
    resetId: string,
    userId: string,
    passwordHash: string,
    changedAt: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordReset.updateMany({
        where: {
          id: resetId,
          userId,
          consumedAt: null,
          expiresAt: { gt: changedAt },
        },
        data: { consumedAt: changedAt },
      });
      if (consumed.count !== 1) return false;

      await transaction.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: changedAt },
        select: { id: true },
      });
      await transaction.passwordReset.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: changedAt },
      });
      return true;
    });
  }

  async changePassword(
    userId: string,
    passwordHash: string,
    changedAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: changedAt },
        select: { id: true },
      }),
      this.prisma.passwordReset.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: changedAt },
      }),
    ]);
  }
}
