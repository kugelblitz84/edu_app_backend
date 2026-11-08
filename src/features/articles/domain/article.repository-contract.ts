import type {
  ArticleQueryOptions,
  PendingArticleQueryOptions,
  ArticleAccessPolicy,
  ArticleStatus,
} from './article.types';
import type { ArticleContentData } from '../../../../mongoose/models/article.model';

export interface ArticleMetadataRecord {
  id: string;
  contentId?: string; // Alias for backward compatibility
  title: string;
  description?: string;
  content?: string; // Fallback plain content for legacy interfaces
  coverImageUrl?: string;
  tags: string[];
  accessPolicy: ArticleAccessPolicy;
  status: ArticleStatus;
  priceAmountMinor?: number;
  currency?: string;
  pinHash?: string;
  contentVersion: number;
  authorId: string;
  authorUsername: string;
  authorFullName?: string;
  unlockedUserIds?: string[]; // Legacy cache/lookup compatibility
  reviewedByUserId?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  rejectReason?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Backward compatibility alias
export type ArticleRecord = ArticleMetadataRecord;

export abstract class ArticleRepository {
  abstract create(data: {
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
  }): Promise<ArticleMetadataRecord>;

  abstract findById(id: string): Promise<ArticleMetadataRecord | null>;

  // Alias for backward compatibility
  findByContentId(contentId: string): Promise<ArticleMetadataRecord | null> {
    return this.findById(contentId);
  }

  abstract updateById(
    id: string,
    updates: Partial<ArticleMetadataRecord>,
  ): Promise<ArticleMetadataRecord | null>;

  // Alias for backward compatibility
  updateByContentId(
    contentId: string,
    updates: Partial<ArticleMetadataRecord>,
  ): Promise<ArticleMetadataRecord | null> {
    return this.updateById(contentId, updates);
  }

  abstract findPublished(
    options: ArticleQueryOptions,
  ): Promise<{ list: ArticleMetadataRecord[]; total: number }>;

  abstract findByAuthor(
    authorId: string,
    options: { page: number; limit: number },
  ): Promise<{ list: ArticleMetadataRecord[]; total: number }>;

  abstract findPending(
    options: PendingArticleQueryOptions,
  ): Promise<{ list: ArticleMetadataRecord[]; total: number }>;

  abstract findRespondedBy(
    reviewerId: string,
    options: { page: number; limit: number },
  ): Promise<{ list: ArticleMetadataRecord[]; total: number }>;

  abstract hasUserUnlocked(articleId: string, userId: string): Promise<boolean>;

  abstract grantUnlock(
    articleId: string,
    userId: string,
    source?: string,
  ): Promise<boolean>;

  // Alias for backward compatibility
  addUnlockUser(contentId: string, userId: string): Promise<boolean> {
    return this.grantUnlock(contentId, userId, 'PIN');
  }
}

export abstract class ArticleContentRepository {
  abstract saveContent(
    articleId: string,
    content: Partial<ArticleContentData>,
  ): Promise<ArticleContentData>;

  abstract findByArticleId(
    articleId: string,
  ): Promise<ArticleContentData | null>;

  abstract deleteByArticleId(articleId: string): Promise<boolean>;
}

export interface ArticleAuthor {
  username: string;
  fullName: string;
}

export abstract class ArticleAuthorRepository {
  abstract findById(userId: string): Promise<ArticleAuthor | null>;
}
