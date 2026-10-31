import { Injectable, Logger } from '@nestjs/common';
import type { Model } from 'mongoose';
import {
  articleSchema,
  type ArticleData,
  type ArticleDocument,
} from '../../../../mongoose/models/article.model';
import { MongooseService } from '../../../core/database/mongoose.service';
import type {
  ArticleQueryOptions,
  PendingArticleQueryOptions,
} from '../domain/article.types';

@Injectable()
export class MongoArticleRepository {
  private readonly logger = new Logger(MongoArticleRepository.name);

  constructor(private readonly mongoose: MongooseService) {}

  private get model(): Model<ArticleDocument> {
    return (
      (this.mongoose.connection.models.Article as
        | Model<ArticleDocument>
        | undefined) ??
      this.mongoose.connection.model<ArticleDocument>('Article', articleSchema)
    );
  }

  async create(data: ArticleData): Promise<ArticleData> {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async findByContentId(contentId: string): Promise<ArticleData | null> {
    const doc = await this.model.findOne({ contentId }).exec();
    return doc ? doc.toObject() : null;
  }

  async updateByContentId(
    contentId: string,
    updates: Partial<ArticleData>,
  ): Promise<ArticleData | null> {
    const doc = await this.model
      .findOneAndUpdate({ contentId }, { $set: updates }, { new: true })
      .exec();
    return doc ? doc.toObject() : null;
  }

  async findPublished(options: ArticleQueryOptions): Promise<{
    list: ArticleData[];
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
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
      ];
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

    return { list: list as ArticleData[], total };
  }

  async findByAuthor(
    authorId: string,
    options: { page: number; limit: number },
  ): Promise<{ list: ArticleData[]; total: number }> {
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

    return { list: list as ArticleData[], total };
  }

  async findPending(options: PendingArticleQueryOptions): Promise<{
    list: ArticleData[];
    total: number;
  }> {
    const filter: Record<string, unknown> = { status: 'PENDING_REVIEW' };

    if (options.policy) {
      filter.accessPolicy = options.policy;
    }

    if (options.search) {
      const searchRegex = new RegExp(options.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { authorUsername: searchRegex },
      ];
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

    return { list: list as ArticleData[], total };
  }

  async findRespondedBy(
    reviewerId: string,
    options: { page: number; limit: number },
  ): Promise<{ list: ArticleData[]; total: number }> {
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

    return { list: list as ArticleData[], total };
  }

  async addUnlockUser(contentId: string, userId: string): Promise<boolean> {
    const result = await this.model
      .updateOne(
        { contentId },
        { $addToSet: { unlockedUserIds: userId } },
      )
      .exec();
    return result.modifiedCount > 0;
  }
}
