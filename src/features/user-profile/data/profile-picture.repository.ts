import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../../core/database/prisma.service';
import type { StorageReference } from '../../../core/modules/storage/domain/storage.types';
import {
  ProfilePictureRepository,
  type ProfilePictureUpload,
} from '../domain/profile-picture.contracts';

const referenceSchema = z.object({
  provider: z.string(),
  locator: z.record(z.string(), z.unknown()),
});
function mapUpload<T extends { reference: unknown }>(
  row: T,
): Omit<T, 'reference'> & { reference: StorageReference } {
  return { ...row, reference: referenceSchema.parse(row.reference) };
}

@Injectable()
export class PrismaProfilePictureRepository implements ProfilePictureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async savePending(upload: ProfilePictureUpload): Promise<void> {
    await this.prisma.profilePictureUpload.create({
      data: {
        ...upload,
        reference: JSON.parse(
          JSON.stringify(upload.reference),
        ) as Prisma.InputJsonValue,
      },
    });
  }

  async findUpload(
    userId: string,
    fileId: string,
  ): Promise<ProfilePictureUpload | null> {
    const row = await this.prisma.profilePictureUpload.findFirst({
      where: {
        id: fileId,
        userId,
        user: { status: 'ACTIVE', deletedAt: null },
      },
    });
    return row ? mapUpload(row) : null;
  }

  async findCurrent(
    user: { userId: string } | { username: string },
  ): Promise<ProfilePictureUpload | null> {
    const row = await this.prisma.profilePictureUpload.findFirst({
      where: {
        isCurrent: true,
        completedAt: { not: null },
        user: {
          ...('userId' in user
            ? { id: user.userId }
            : { username: user.username }),
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
    });
    return row ? mapUpload(row) : null;
  }

  activate(
    userId: string,
    fileId: string,
    reference: StorageReference,
  ): Promise<ProfilePictureUpload | null> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the user row before reading/replacing the current picture.
      const locked = await tx.user.updateMany({
        where: { id: userId, status: 'ACTIVE', deletedAt: null },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new NotFoundException('User profile not found.');
      const upload = await tx.profilePictureUpload.findFirst({
        where: { id: fileId, userId },
      });
      if (!upload)
        throw new NotFoundException('Profile picture upload not found.');
      if (upload.completedAt) {
        if (upload.isCurrent) return null;
        throw new ConflictException(
          'This profile picture has already been replaced.',
        );
      }
      if (upload.expiresAt <= new Date())
        throw new ConflictException('Profile picture upload expired.');
      const previous = await tx.profilePictureUpload.findFirst({
        where: { userId, isCurrent: true },
      });
      await tx.profilePictureUpload.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.profilePictureUpload.update({
        where: { id: fileId },
        data: {
          reference: JSON.parse(
            JSON.stringify(reference),
          ) as Prisma.InputJsonValue,
          completedAt: new Date(),
          isCurrent: true,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { avatarUrl: null },
      });
      return previous ? mapUpload(previous) : null;
    });
  }
}
