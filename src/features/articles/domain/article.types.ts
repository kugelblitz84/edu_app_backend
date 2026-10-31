export type ArticleAccessPolicy = 'FREE' | 'PURCHASE';
export type ArticleStatus =
  'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

export interface CreateArticleInput {
  title: string;
  description?: string;
  content: string;
  accessPolicy: ArticleAccessPolicy;
  priceAmountMinor?: number;
  currency?: string;
  pin?: string;
  tags?: string[];
  coverImageUrl?: string;
}

export interface UpdateArticleInput {
  title?: string;
  description?: string;
  content?: string;
  accessPolicy?: ArticleAccessPolicy;
  priceAmountMinor?: number;
  currency?: string;
  pin?: string;
  tags?: string[];
  coverImageUrl?: string;
}

export interface ArticleReviewInput {
  status: 'APPROVED' | 'REJECTED';
  rejectReason?: string;
  reviewNotes?: string;
}

export interface ArticleQueryOptions {
  page: number;
  limit: number;
  search?: string;
  tag?: string;
  policy?: ArticleAccessPolicy;
}

export interface PendingArticleQueryOptions {
  page: number;
  limit: number;
  search?: string;
  policy?: ArticleAccessPolicy;
}

export interface ArticleSummaryView {
  contentId: string;
  title: string;
  description?: string;
  accessPolicy: ArticleAccessPolicy;
  priceAmountMinor?: number;
  currency?: string;
  status: ArticleStatus;
  tags: string[];
  coverImageUrl?: string;
  authorUsername: string;
  authorFullName?: string;
  createdAt: Date;
  publishedAt?: Date;
}

export interface ArticleDetailView extends ArticleSummaryView {
  content?: string;
  previewSnippet?: string;
  access: {
    canAccess: boolean;
    reason?:
      | 'FREE'
      | 'PIN_REQUIRED'
      | 'OWNER'
      | 'UNLOCKED'
      | 'UNAVAILABLE'
      | 'SUPER_ADMIN';
    source?: 'OWNER' | 'UNLOCKED';
  };
  rejectReason?: string;
  reviewNotes?: string;
}
