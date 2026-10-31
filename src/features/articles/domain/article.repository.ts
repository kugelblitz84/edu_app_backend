import type {
  ArticleQueryOptions,
  PendingArticleQueryOptions,
} from './article.types';
import type { ArticleAccessPolicy, ArticleStatus } from './article.types';

export interface ArticleRecord {
  contentId: string;
  title: string;
  description?: string;
  content: string;
  accessPolicy: ArticleAccessPolicy;
  priceAmountMinor?: number;
  currency?: string;
  pinHash?: string;
  status: ArticleStatus;
  tags?: string[];
  coverImageUrl?: string;
  authorId: string;
  authorUsername: string;
  authorFullName?: string;
  unlockedUserIds?: string[];
  rejectReason?: string;
  reviewNotes?: string;
  reviewedByUserId?: string;
  reviewedAt?: Date;
  publishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export abstract class ArticleRepository {
  abstract create(data: ArticleRecord): Promise<ArticleRecord>;
  abstract findByContentId(contentId: string): Promise<ArticleRecord | null>;
  abstract updateByContentId(
    contentId: string,
    updates: Partial<ArticleRecord>,
  ): Promise<ArticleRecord | null>;
  abstract findPublished(
    options: ArticleQueryOptions,
  ): Promise<{ list: ArticleRecord[]; total: number }>;
  abstract findByAuthor(
    authorId: string,
    options: { page: number; limit: number },
  ): Promise<{ list: ArticleRecord[]; total: number }>;
  abstract findPending(
    options: PendingArticleQueryOptions,
  ): Promise<{ list: ArticleRecord[]; total: number }>;
  abstract findRespondedBy(
    reviewerId: string,
    options: { page: number; limit: number },
  ): Promise<{ list: ArticleRecord[]; total: number }>;
  abstract addUnlockUser(contentId: string, userId: string): Promise<boolean>;
}

export interface ArticleAuthor {
  username: string;
  fullName: string;
}

export abstract class ArticleAuthorRepository {
  abstract findById(userId: string): Promise<ArticleAuthor | null>;
}
