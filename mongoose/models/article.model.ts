import mongoose, { type Document, type Model } from 'mongoose';
import type { ArticleRecord } from '../../src/features/articles/domain/article.repository';
// import type {
//   ArticleAccessPolicy,
//   ArticleStatus,
// } from '../../src/features/articles/domain/article.types';

export type {
  ArticleAccessPolicy,
  ArticleStatus,
} from '../../src/features/articles/domain/article.types';
export type ArticleDocument = ArticleRecord & Document;

export const articleSchema = new mongoose.Schema<ArticleRecord>(
  {
    contentId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: false, trim: true },
    content: { type: String, required: true },
    accessPolicy: {
      type: String,
      enum: ['FREE', 'PURCHASE'],
      default: 'FREE',
      index: true,
    },
    priceAmountMinor: { type: Number, required: false },
    currency: { type: String, required: false, default: 'USD' },
    pinHash: { type: String, required: false },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    tags: { type: [String], default: [] },
    coverImageUrl: { type: String, required: false },
    authorId: { type: String, required: true, index: true },
    authorUsername: { type: String, required: true },
    authorFullName: { type: String, required: false },
    unlockedUserIds: { type: [String], default: [] },
    rejectReason: { type: String, required: false },
    reviewNotes: { type: String, required: false },
    reviewedByUserId: { type: String, required: false },
    reviewedAt: { type: Date, required: false },
    publishedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

articleSchema.index({ status: 1, accessPolicy: 1, createdAt: -1 });
articleSchema.index({ authorId: 1, status: 1 });
