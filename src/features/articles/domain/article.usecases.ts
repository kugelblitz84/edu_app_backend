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
  ArticleContentRepository,
  ArticleRepository,
  type ArticleMetadataRecord,
} from './article.repository-contract';
import type {
  ArticleDetailView,
  ArticleQueryOptions,
  ArticleReviewInput,
  ArticleSection,
  ArticleSummaryView,
  ArticleTheme,
  CreateArticleInput,
  PendingArticleQueryOptions,
  UpdateArticleInput,
} from './article.types';

const DEFAULT_THEME: ArticleTheme = {
  baseFont: 'Inter',
  headingFont: 'Playfair Display',
  containerWidth: 'normal',
};

@Injectable()
export class ArticleUseCases {
  constructor(
    private readonly repository: ArticleRepository,
    private readonly contentRepository: ArticleContentRepository,
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

    let pinHash: string | undefined;
    if (input.accessPolicy === 'PURCHASE') {
      if (!input.pin) {
        throw new BadRequestException(
          'A PIN is required for PURCHASE articles.',
        );
      }
      pinHash = await this.hasher.hash(input.pin);
    }

    const sections =
      input.sections && input.sections.length > 0
        ? input.sections
        : this.buildDefaultSections(input.content);
    const theme = input.theme ?? DEFAULT_THEME;
    const plainTextSummary = this.extractPlainText(sections, input.content);

    const created = await this.repository.create({
      title: input.title,
      description: input.description,
      accessPolicy: input.accessPolicy,
      priceAmountMinor: input.priceAmountMinor,
      currency: input.currency ?? 'USD',
      pinHash,
      tags: input.tags ?? [],
      coverImageUrl: input.coverImageUrl,
      authorId: actor.userId,
    });

    await this.contentRepository.saveContent(created.id, {
      articleId: created.id,
      version: 1,
      theme,
      sections,
      plainTextSummary,
    });

    return this.toSummary(created);
  }

  async updateDraft(
    actor: AuthenticatedUser,
    contentId: string,
    input: UpdateArticleInput,
  ): Promise<ArticleSummaryView> {
    const article = await this.repository.findById(contentId);
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

    const updates: Partial<ArticleMetadataRecord> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined)
      updates.description = input.description;
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

    const hasContentUpdates =
      input.sections !== undefined ||
      input.theme !== undefined ||
      input.content !== undefined;

    if (hasContentUpdates) {
      const existingContent =
        await this.contentRepository.findByArticleId(contentId);
      const theme = input.theme ?? existingContent?.theme ?? DEFAULT_THEME;
      const sections =
        input.sections ??
        (input.content !== undefined
          ? this.buildDefaultSections(input.content)
          : existingContent?.sections ?? []);
      const plainTextSummary = this.extractPlainText(
        sections,
        input.content ?? existingContent?.plainTextSummary,
      );

      const nextVersion = (article.contentVersion ?? 1) + 1;
      await this.contentRepository.saveContent(contentId, {
        articleId: contentId,
        version: nextVersion,
        theme,
        sections,
        plainTextSummary,
      });

      updates.contentVersion = nextVersion;
    }

    const updated = await this.repository.updateById(contentId, updates);
    if (!updated) {
      throw new NotFoundException('Failed to update article.');
    }

    return this.toSummary(updated);
  }

  async submitForReview(
    actor: AuthenticatedUser,
    contentId: string,
  ): Promise<ArticleSummaryView> {
    const article = await this.repository.findById(contentId);
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

    const contentDoc = await this.contentRepository.findByArticleId(contentId);
    const text =
      contentDoc?.plainTextSummary ??
      this.extractPlainText(contentDoc?.sections, article.content);

    if (!text || text.trim().length < 10) {
      throw new BadRequestException(
        'Article content must be at least 10 characters before submitting.',
      );
    }

    const updated = await this.repository.updateById(contentId, {
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
    const article = await this.repository.findById(contentId);
    if (!article) {
      throw new NotFoundException('Article not found.');
    }

    const isAuthor = viewerId ? article.authorId === viewerId : false;
    const isUnlocked = viewerId
      ? await this.repository.hasUserUnlocked(contentId, viewerId)
      : false;

    if (article.status !== 'PUBLISHED' && !isAuthor) {
      throw new NotFoundException('Article not found.');
    }

    const baseSummary = this.toSummary(article);

    if (article.accessPolicy === 'FREE' || isAuthor || isUnlocked) {
      const contentDoc =
        await this.contentRepository.findByArticleId(contentId);
      const reason =
        article.accessPolicy === 'FREE'
          ? 'FREE'
          : isAuthor
            ? 'OWNER'
            : 'UNLOCKED';
      const source =
        article.accessPolicy === 'FREE'
          ? undefined
          : isAuthor
            ? 'OWNER'
            : 'UNLOCKED';

      return {
        ...baseSummary,
        content: contentDoc?.plainTextSummary ?? article.content,
        contentPayload: contentDoc ?? undefined,
        access: {
          canAccess: true,
          reason,
          source,
        },
      };
    }

    const contentDoc = await this.contentRepository.findByArticleId(contentId);
    const summaryText = contentDoc?.plainTextSummary ?? article.description;
    const previewSnippet =
      article.description ||
      (summaryText && summaryText.length > 300
        ? `${summaryText.slice(0, 300)}...`
        : summaryText) ||
      'This article requires unlocking with a PIN.';

    return {
      ...baseSummary,
      previewSnippet,
      content: undefined,
      contentPayload: undefined,
      access: { canAccess: false, reason: 'PIN_REQUIRED' },
    };
  }

  async unlockArticle(
    actor: AuthenticatedUser,
    contentId: string,
    pin: string,
  ): Promise<{ success: boolean; message: string }> {
    const article = await this.repository.findById(contentId);
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

    const alreadyUnlocked = await this.repository.hasUserUnlocked(
      contentId,
      actor.userId,
    );
    if (alreadyUnlocked) {
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

    await this.repository.grantUnlock(contentId, actor.userId, 'PIN');
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
    const article = await this.repository.findById(contentId);
    if (!article) {
      throw new NotFoundException('Article not found.');
    }

    const contentDoc = await this.contentRepository.findByArticleId(contentId);
    const baseSummary = this.toSummary(article);
    return {
      ...baseSummary,
      content: contentDoc?.plainTextSummary ?? article.content,
      contentPayload: contentDoc ?? undefined,
      access: { canAccess: true, reason: 'SUPER_ADMIN' },
    };
  }

  async reviewArticle(
    adminUser: AuthenticatedUser,
    contentId: string,
    input: ArticleReviewInput,
  ): Promise<ArticleSummaryView> {
    const article = await this.repository.findById(contentId);
    if (!article) {
      throw new NotFoundException('Article not found.');
    }

    if (article.status !== 'PENDING_REVIEW') {
      throw new ConflictException(
        'Only articles in PENDING_REVIEW status can be adjudicated.',
      );
    }

    const updates: Partial<ArticleMetadataRecord> = {
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

    const updated = await this.repository.updateById(contentId, updates);
    if (!updated) {
      throw new NotFoundException('Failed to finalize review.');
    }

    return this.toSummary(updated);
  }

  private extractPlainText(
    sections?: ArticleSection[],
    fallback?: string,
  ): string {
    if (!sections || sections.length === 0) {
      return fallback?.trim() ?? '';
    }

    const texts: string[] = [];
    for (const sec of sections) {
      const allBlocks = [
        ...(sec.blocks ?? []),
        ...(sec.columnLeft ?? []),
        ...(sec.columnRight ?? []),
      ];
      for (const b of allBlocks) {
        if (b.type === 'HEADING' && b.text) {
          texts.push(b.text);
        } else if (b.type === 'PARAGRAPH' && b.html) {
          texts.push(b.html.replace(/<[^>]*>/g, ' '));
        } else if (b.type === 'QUOTE' && b.text) {
          texts.push(b.text);
        }
      }
    }

    const fullText = texts.join(' ').replace(/\s+/g, ' ').trim();
    return fullText || (fallback?.trim() ?? '');
  }

  private buildDefaultSections(content?: string): ArticleSection[] {
    if (!content) return [];
    return [
      {
        id: randomUUID(),
        layout: 'SINGLE_COLUMN',
        blocks: [
          {
            id: randomUUID(),
            type: 'PARAGRAPH',
            html: `<p>${content}</p>`,
          },
        ],
      },
    ];
  }

  private toSummary(item: ArticleMetadataRecord): ArticleSummaryView {
    const id = item.id || item.contentId || '';
    return {
      id,
      contentId: id,
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
