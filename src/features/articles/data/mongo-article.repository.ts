import { Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import {
  articleSchema,
  type ArticleDocument,
} from '../../../../mongoose/models/article.model';
import { MongooseService } from '../../../core/database/mongoose.service';
import {
  ArticleRepository,
  type ArticleRecord,
} from '../domain/article.repository-contract';
import type {
  ArticleQueryOptions,
  PendingArticleQueryOptions,
} from '../domain/article.types';

@Injectable()
export class MongoArticleRepository extends ArticleRepository {
  constructor(private readonly mongoose: MongooseService) {
    super();
  }

  private get model(): Model<ArticleDocument> {
    return (
      (this.mongoose.connection.models.Article as
        Model<ArticleDocument> | undefined) ??
      this.mongoose.connection.model<ArticleDocument>('Article', articleSchema)
    );
  }

  async create(data: ArticleRecord): Promise<ArticleRecord> {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async findByContentId(contentId: string): Promise<ArticleRecord | null> {
    const doc = await this.model.findOne({ contentId }).exec();
    return doc ? doc.toObject() : null;
  }

  async updateByContentId(
    contentId: string,
    updates: Partial<ArticleRecord>,
  ): Promise<ArticleRecord | null> {
    const doc = await this.model
      .findOneAndUpdate({ contentId }, { $set: updates }, { new: true })
      .exec();
    return doc ? doc.toObject() : null;
  }

  async findPublished(options: ArticleQueryOptions): Promise<{
    list: ArticleRecord[];
    total: number;
  }> {
    const filter: Record<string, unknown> = { status: 'PUBLISHED' };

    if (options.policy) {
      filter.accessPolicy = options.policy;
    }

    if (options.tag) {
      filter.tags = options.tag;
    }

    if (options.search) {
      const searchRegex = new RegExp(options.search, 'i');
      filter.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const skip = (options.page - 1) * options.limit;
    const [list, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(options.limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { list: list as ArticleRecord[], total };
  }

  async findByAuthor(
    authorId: string,
    options: { page: number; limit: number },
  ): Promise<{ list: ArticleRecord[]; total: number }> {
    const filter = { authorId };
    const skip = (options.page - 1) * options.limit;
    const [list, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(options.limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { list: list as ArticleRecord[], total };
  }

  async findPending(options: PendingArticleQueryOptions): Promise<{
    list: ArticleRecord[];
    total: number;
  }> {
    const filter: Record<string, unknown> = { status: 'PENDING_REVIEW' };

    if (options.policy) {
      filter.accessPolicy = options.policy;
    }

    if (options.search) {
      const searchRegex = new RegExp(options.search, 'i');
      filter.$or = [{ title: searchRegex }, { authorUsername: searchRegex }];
    }

    const skip = (options.page - 1) * options.limit;
    const [list, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: 1 }) // FIFO for admin reviews
        .skip(skip)
        .limit(options.limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { list: list as ArticleRecord[], total };
  }

  async findRespondedBy(
    reviewerId: string,
    options: { page: number; limit: number },
  ): Promise<{ list: ArticleRecord[]; total: number }> {
    const filter = { reviewedByUserId: reviewerId };
    const skip = (options.page - 1) * options.limit;
    const [list, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ reviewedAt: -1 })
        .skip(skip)
        .limit(options.limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { list: list as ArticleRecord[], total };
  }

  async addUnlockUser(contentId: string, userId: string): Promise<boolean> {
    const result = await this.model
      .updateOne({ contentId }, { $addToSet: { unlockedUserIds: userId } })
      .exec();
    return result.modifiedCount > 0;
  }
}
