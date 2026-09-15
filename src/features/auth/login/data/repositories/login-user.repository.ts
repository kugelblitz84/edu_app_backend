import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../core/database/prisma.service';
import {
  LoginUserRepository,
  type LoginUserRecord,
} from '../../domain/contracts/login-user.repository';

@Injectable()
export class PrismaLoginUserRepository implements LoginUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string): Promise<LoginUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        passwordHash: true,
        platformRole: true,
        status: true,
        emailVerifiedAt: true,
      },
    });
  }

  async recordSuccessfulLogin(
    userId: string,
    loggedInAt: Date,
    ipAddress?: string,
    ipRegion?: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: loggedInAt,
        lastLoginIp: ipAddress,
        lastLoginRegion: ipRegion,
      },
      select: { id: true },
    });
  }
}
