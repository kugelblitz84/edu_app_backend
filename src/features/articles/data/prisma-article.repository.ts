import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  ArticleRepository,
  type ArticleMetadataRecord,
} from '../domain/article.repository-contract';
import type {
  ArticleAccessPolicy,
  ArticleQueryOptions,
  PendingArticleQueryOptions,
} from '../domain/article.types';

@Injectable()
export class PrismaArticleRepository extends ArticleRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: {
    id?: string;
    title: string;
    description?: string;
    coverImageUrl?: string;
    tags?: string[];
    accessPolicy: ArticleAccessPolicy;
    priceAmountMinor?: number;
    currency?: string;
    pinHash?: string;
    authorId: string;
  }): Promise<ArticleMetadataRecord> {
    const created = await this.prisma.article.create({
      data: {
        id: data.id,
        title: data.title,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
        tags: data.tags ?? [],
        accessPolicy: data.accessPolicy,
        priceAmountMinor: data.priceAmountMinor,
        currency: data.currency ?? 'USD',
        pinHash: data.pinHash,
        authorId: data.authorId,
      },
      include: {
        author: {
          select: { username: true, fullName: true },
        },
      },
    });

    return this.toRecord(created);
  }

  async findById(id: string): Promise<ArticleMetadataRecord | null> {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        author: {
          select: { username: true, fullName: true },
        },
        unlockGrants: {
          select: { userId: true },
        },
      },
    });
    if (!article) return null;
    return this.toRecord(article);
  }

  async updateById(
    id: string,
    updates: Partial<ArticleMetadataRecord>,
  ): Promise<ArticleMetadataRecord | null> {
    const data: Prisma.ArticleUpdateInput = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined)
      data.description = updates.description;
    if (updates.coverImageUrl !== undefined)
      data.coverImageUrl = updates.coverImageUrl;
    if (updates.tags !== undefined) data.tags = updates.tags;
    if (updates.accessPolicy !== undefined)
      data.accessPolicy = updates.accessPolicy;
    if (updates.priceAmountMinor !== undefined)
      data.priceAmountMinor = updates.priceAmountMinor;
    if (updates.currency !== undefined) data.currency = updates.currency;
    if (updates.pinHash !== undefined) data.pinHash = updates.pinHash;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.rejectReason !== undefined)
      data.rejectReason = updates.rejectReason;
    if (updates.reviewNotes !== undefined)
      data.reviewNotes = updates.reviewNotes;
    if (updates.reviewedByUserId !== undefined) {
      data.reviewedByUser = updates.reviewedByUserId
        ? { connect: { id: updates.reviewedByUserId } }
        : { disconnect: true };
    }
    if (updates.reviewedAt !== undefined) data.reviewedAt = updates.reviewedAt;
    if (updates.publishedAt !== undefined)
      data.publishedAt = updates.publishedAt;
    if (updates.deletedAt !== undefined) data.deletedAt = updates.deletedAt;
    if (updates.contentVersion !== undefined)
      data.contentVersion = updates.contentVersion;

    try {
      const updated = await this.prisma.article.update({
        where: { id },
        data,
        include: {
          author: {
            select: { username: true, fullName: true },
          },
          unlockGrants: {
            select: { userId: true },
          },
        },
      });

      return this.toRecord(updated);
    } catch {
      return null;
    }
  }

  async findPublished(options: ArticleQueryOptions): Promise<{
    list: ArticleMetadataRecord[];
    total: number;
  }> {
    const where: Prisma.ArticleWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
    };

    if (options.policy) {
      where.accessPolicy = options.policy;
    }

    if (options.tag) {
      where.tags = { has: options.tag };
    }

    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const skip = (options.page - 1) * options.limit;
    const [list, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          author: { select: { username: true, fullName: true } },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toRecord(item)),
      total,
    };
  }

  async findByAuthor(
    authorId: string,
    options: { page: number; limit: number },
  ): Promise<{ list: ArticleMetadataRecord[]; total: number }> {
    const where: Prisma.ArticleWhereInput = {
      authorId,
      deletedAt: null,
    };

    const skip = (options.page - 1) * options.limit;
    const [list, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { username: true, fullName: true } },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toRecord(item)),
      total,
    };
  }

  async findPending(options: PendingArticleQueryOptions): Promise<{
    list: ArticleMetadataRecord[];
    total: number;
  }> {
    const where: Prisma.ArticleWhereInput = {
      status: 'PENDING_REVIEW',
      deletedAt: null,
    };

    if (options.policy) {
      where.accessPolicy = options.policy;
    }

    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        {
          author: {
            username: { contains: options.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const skip = (options.page - 1) * options.limit;
    const [list, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { username: true, fullName: true } },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toRecord(item)),
      total,
    };
  }

  async findRespondedBy(
    reviewerId: string,
    options: { page: number; limit: number },
  ): Promise<{ list: ArticleMetadataRecord[]; total: number }> {
    const where: Prisma.ArticleWhereInput = {
      reviewedByUserId: reviewerId,
      deletedAt: null,
    };

    const skip = (options.page - 1) * options.limit;
    const [list, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: { reviewedAt: 'desc' },
        include: {
          author: { select: { username: true, fullName: true } },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      list: list.map((item) => this.toRecord(item)),
      total,
    };
  }

  async hasUserUnlocked(articleId: string, userId: string): Promise<boolean> {
    const grant = await this.prisma.articleUnlockGrant.findUnique({
      where: {
        articleId_userId: {
          articleId,
          userId,
        },
      },
    });
    return Boolean(grant);
  }

  async grantUnlock(
    articleId: string,
    userId: string,
    source = 'PIN',
  ): Promise<boolean> {
    try {
      await this.prisma.articleUnlockGrant.upsert({
        where: {
          articleId_userId: { articleId, userId },
        },
        create: {
          articleId,
          userId,
          source,
        },
        update: {},
      });
      return true;
    } catch {
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toRecord(item: any): ArticleMetadataRecord {
    return {
      id: item.id,
      contentId: item.id,
      title: item.title,
      description: item.description ?? undefined,
      coverImageUrl: item.coverImageUrl ?? undefined,
      tags: item.tags ?? [],
      accessPolicy: item.accessPolicy,
      status: item.status,
      priceAmountMinor: item.priceAmountMinor ?? undefined,
      currency: item.currency ?? undefined,
      pinHash: item.pinHash ?? undefined,
      contentVersion: item.contentVersion ?? 1,
      authorId: item.authorId,
      authorUsername: item.author?.username ?? '',
      authorFullName: item.author?.fullName ?? undefined,
      unlockedUserIds: item.unlockGrants
        ? item.unlockGrants.map((g: { userId: string }) => g.userId)
        : [],
      reviewedByUserId: item.reviewedByUserId ?? undefined,
      reviewedAt: item.reviewedAt ?? undefined,
      reviewNotes: item.reviewNotes ?? undefined,
      rejectReason: item.rejectReason ?? undefined,
      publishedAt: item.publishedAt ?? undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt ?? undefined,
    };
  }
}
