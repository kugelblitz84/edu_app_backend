import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { ScryptSecretHasher } from '../../../core/security/scrypt-secret-hasher.service';
import { ScryptSecretVerifier } from '../../../core/security/scrypt-secret-verifier.service';
import {
  ArticleAuthorRepository,
  ArticleRepository,
  type ArticleRecord,
} from './article.repository-contract';
import type {
  ArticleQueryOptions,
  ArticleReviewInput,
  ArticleDetailView,
  ArticleSummaryView,
  CreateArticleInput,
  PendingArticleQueryOptions,
  UpdateArticleInput,
} from './article.types';

@Injectable()
export class ArticleUseCases {
  constructor(
    private readonly repository: ArticleRepository,
    private readonly authors: ArticleAuthorRepository,
    private readonly hasher: ScryptSecretHasher,
    private readonly verifier: ScryptSecretVerifier,
  ) {}

  async createDraft(
    actor: AuthenticatedUser,
    input: CreateArticleInput,
  ): Promise<ArticleSummaryView> {
    const user = await this.authors.findById(actor.userId);

    if (!user) {
      throw new NotFoundException('User profile not found.');
    }

    const contentId = randomUUID();
    let pinHash: string | undefined;

    if (input.accessPolicy === 'PURCHASE') {
      if (!input.pin) {
        throw new BadRequestException(
          'A PIN is required for PURCHASE articles.',
        );
      }
      pinHash = await this.hasher.hash(input.pin);
    }

    const data: ArticleRecord = {
      contentId,
      title: input.title,
      description: input.description,
      content: input.content,
      accessPolicy: input.accessPolicy,
      priceAmountMinor: input.priceAmountMinor,
      currency: input.currency ?? 'USD',
      pinHash,
      status: 'DRAFT',
      tags: input.tags ?? [],
      coverImageUrl: input.coverImageUrl,
      authorId: actor.userId,
      authorUsername: user.username,
      authorFullName: user.fullName,
      unlockedUserIds: [],
    };

    const created = await this.repository.create(data);
    return this.toSummary(created);
  }

  async updateDraft(
    actor: AuthenticatedUser,
    contentId: string,
    input: UpdateArticleInput,
  ): Promise<ArticleSummaryView> {
    const article = await this.repository.findByContentId(contentId);
    if (!article) {
      throw new NotFoundException('Article not found.');
    }

    if (article.authorId !== actor.userId) {
      throw new ForbiddenException(
        'You are not authorized to edit this article.',
      );
    }

    if (article.status !== 'DRAFT' && article.status !== 'REJECTED') {
      throw new ConflictException(
        'Only articles in DRAFT or REJECTED status can be modified.',
      );
    }

    const updates: Partial<ArticleRecord> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined)
      updates.description = input.description;
    if (input.content !== undefined) updates.content = input.content;
    if (input.tags !== undefined) updates.tags = input.tags;
    if (input.coverImageUrl !== undefined)
      updates.coverImageUrl = input.coverImageUrl;

    if (input.accessPolicy !== undefined) {
      updates.accessPolicy = input.accessPolicy;
      if (input.accessPolicy === 'PURCHASE') {
        if (input.pin) {
          updates.pinHash = await this.hasher.hash(input.pin);
        } else if (!article.pinHash) {
          throw new BadRequestException('PURCHASE articles require a PIN.');
        }
        if (input.priceAmountMinor !== undefined) {
          updates.priceAmountMinor = input.priceAmountMinor;
        }
        if (input.currency !== undefined) {
          updates.currency = input.currency;
        }
      } else {
        updates.pinHash = undefined;
        updates.priceAmountMinor = undefined;
      }
    } else if (input.pin) {
      if (article.accessPolicy !== 'PURCHASE') {
        throw new BadRequestException('Cannot set a PIN on a FREE article.');
      }
      updates.pinHash = await this.hasher.hash(input.pin);
    }

    const updated = await this.repository.updateByContentId(contentId, updates);
    if (!updated) {
      throw new NotFoundException('Failed to update article.');
    }

    return this.toSummary(updated);
  }

  async submitForReview(
    actor: AuthenticatedUser,
    contentId: string,
  ): Promise<ArticleSummaryView> {
    const article = await this.repository.findByContentId(contentId);
    if (!article) {
      throw new NotFoundException('Article not found.');
    }

    if (article.authorId !== actor.userId) {
      throw new ForbiddenException(
        'You are not authorized to submit this article.',
      );
    }

    if (article.status !== 'DRAFT' && article.status !== 'REJECTED') {
      throw new ConflictException(
        'Only DRAFT or REJECTED articles can be submitted for review.',
      );
    }

    if (!article.content || article.content.trim().length < 10) {
      throw new BadRequestException(
        'Article content must be at least 10 characters before submitting.',
      );
    }

    const updated = await this.repository.updateByContentId(contentId, {
      status: 'PENDING_REVIEW',
    });

    if (!updated) {
      throw new NotFoundException('Failed to submit article.');
    }

    return this.toSummary(updated);
  }

  async getPublishedArticles(query: ArticleQueryOptions): Promise<{
    list: ArticleSummaryView[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const { list, total } = await this.repository.findPublished(query);
    const totalPages = Math.ceil(total / query.limit) || 0;

    return {
      list: list.map((item) => this.toSummary(item)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
    };
  }

  async getArticleDetail(
    contentId: string,
    viewerId?: string,
  ): Promise<ArticleDetailView> {
    const article = await this.repository.findByContentId(contentId);
    if (!article) {
      throw new NotFoundException('Article not found.');
    }

    const isAuthor = viewerId ? article.authorId === viewerId : false;
    const isUnlocked = viewerId
      ? article.unlockedUserIds?.includes(viewerId)
      : false;

    // Non-published articles can only be inspected by author or superadmin
    if (article.status !== 'PUBLISHED' && !isAuthor) {
      throw new NotFoundException('Article not found.');
    }

    const baseSummary = this.toSummary(article);

    // Free article
    if (article.accessPolicy === 'FREE') {
      return {
        ...baseSummary,
        content: article.content,
        access: { canAccess: true, reason: 'FREE' },
      };
    }

    // Purchase article: Author or Unlocked
    if (isAuthor || isUnlocked) {
      return {
        ...baseSummary,
        content: article.content,
        access: {
          canAccess: true,
          source: isAuthor ? 'OWNER' : 'UNLOCKED',
          reason: isAuthor ? 'OWNER' : 'UNLOCKED',
        },
      };
    }

    // Purchase article: Locked (Return synopsis preview only)
    const previewSnippet =
      article.description ||
      (article.content.length > 300
        ? `${article.content.slice(0, 300)}...`
        : article.content);

    return {
      ...baseSummary,
      previewSnippet,
      content: undefined,
      access: { canAccess: false, reason: 'PIN_REQUIRED' },
    };
  }

  async unlockArticle(
    actor: AuthenticatedUser,
    contentId: string,
    pin: string,
  ): Promise<{ success: boolean; message: string }> {
    const article = await this.repository.findByContentId(contentId);
    if (!article) {
      throw new NotFoundException('Article not found.');
    }

    if (article.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published articles can be unlocked.');
    }

    if (article.accessPolicy !== 'PURCHASE') {
      return {
        success: true,
        message: 'This article is already free to read.',
      };
    }

    if (article.unlockedUserIds?.includes(actor.userId)) {
      return {
        success: true,
        message: 'Article is already unlocked on your account.',
      };
    }

    if (!article.pinHash) {
      throw new BadRequestException('PIN configuration error on this article.');
    }

    const valid = await this.verifier.verify(pin, article.pinHash);
    if (!valid) {
      throw new ForbiddenException('Invalid PIN code.');
    }

    await this.repository.addUnlockUser(contentId, actor.userId);
    return { success: true, message: 'Article unlocked successfully.' };
  }

  async getMyArticles(
    actor: AuthenticatedUser,
    options: { page: number; limit: number },
  ): Promise<{
    list: (ArticleSummaryView & {
      status: string;
      rejectReason?: string;
      reviewNotes?: string;
    })[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { list, total } = await this.repository.findByAuthor(
      actor.userId,
      options,
    );

    return {
      list: list.map((item) => ({
        ...this.toSummary(item),
        status: item.status,
        rejectReason: item.rejectReason,
        reviewNotes: item.reviewNotes,
      })),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  // --- Super Admin Review Methods ---

  async getPendingArticles(options: PendingArticleQueryOptions): Promise<{
    list: ArticleSummaryView[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { list, total } = await this.repository.findPending(options);
    return {
      list: list.map((item) => this.toSummary(item)),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  async getRespondedByMe(
    reviewerId: string,
    options: { page: number; limit: number },
  ): Promise<{
    list: (ArticleSummaryView & {
      reviewedAt?: Date;
      rejectReason?: string;
      reviewNotes?: string;
    })[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { list, total } = await this.repository.findRespondedBy(
      reviewerId,
      options,
    );
    return {
      list: list.map((item) => ({
        ...this.toSummary(item),
        reviewedAt: item.reviewedAt,
        rejectReason: item.rejectReason,
        reviewNotes: item.reviewNotes,
      })),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  async getArticleForAdminReview(
    contentId: string,
  ): Promise<ArticleDetailView> {
    const article = await this.repository.findByContentId(contentId);
    if (!article) {
      throw new NotFoundException('Article not found.');
    }

    const baseSummary = this.toSummary(article);
    return {
      ...baseSummary,
      content: article.content,
      access: { canAccess: true, reason: 'SUPER_ADMIN' },
    };
  }

  async reviewArticle(
    adminUser: AuthenticatedUser,
    contentId: string,
    input: ArticleReviewInput,
  ): Promise<ArticleSummaryView> {
    const article = await this.repository.findByContentId(contentId);
    if (!article) {
      throw new NotFoundException('Article not found.');
    }

    if (article.status !== 'PENDING_REVIEW') {
      throw new ConflictException(
        'Only articles in PENDING_REVIEW status can be adjudicated.',
      );
    }

    const updates: Partial<ArticleRecord> = {
      reviewedByUserId: adminUser.userId,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes,
    };

    if (input.status === 'APPROVED') {
      updates.status = 'PUBLISHED';
      updates.publishedAt = new Date();
      updates.rejectReason = undefined;
    } else {
      updates.status = 'REJECTED';
      updates.rejectReason = input.rejectReason;
    }

    const updated = await this.repository.updateByContentId(contentId, updates);
    if (!updated) {
      throw new NotFoundException('Failed to finalize review.');
    }

    return this.toSummary(updated);
  }

  private toSummary(item: ArticleRecord): ArticleSummaryView {
    return {
      contentId: item.contentId,
      title: item.title,
      description: item.description,
      accessPolicy: item.accessPolicy,
      priceAmountMinor: item.priceAmountMinor,
      currency: item.currency,
      status: item.status,
      tags: item.tags ?? [],
      coverImageUrl: item.coverImageUrl,
      authorUsername: item.authorUsername,
      authorFullName: item.authorFullName,
      createdAt: item.createdAt ?? new Date(),
      publishedAt: item.publishedAt,
    };
  }
}
