import { Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import {
  articleContentSchema,
  type ArticleContentData,
  type ArticleContentDocument,
} from '../../../../mongoose/models/article.model';
import { MongooseService } from '../../../core/database/mongoose.service';
import { ArticleContentRepository } from '../domain/article.repository-contract';

@Injectable()
export class MongoArticleContentRepository extends ArticleContentRepository {
  constructor(private readonly mongoose: MongooseService) {
    super();
  }

  private get model(): Model<ArticleContentDocument> {
    return (
      (this.mongoose.connection.models.ArticleContent as
        | Model<ArticleContentDocument>
        | undefined) ??
      this.mongoose.connection.model<ArticleContentDocument>(
        'ArticleContent',
        articleContentSchema,
      )
    );
  }

  async saveContent(
    articleId: string,
    content: Partial<ArticleContentData>,
  ): Promise<ArticleContentData> {
    const doc = await this.model
      .findOneAndUpdate(
        { articleId },
        {
          $set: {
            ...content,
            articleId,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean<ArticleContentData>()
      .exec();

    return doc as ArticleContentData;
  }

  async findByArticleId(
    articleId: string,
  ): Promise<ArticleContentData | null> {
    const doc = await this.model
      .findOne({ articleId })
      .lean<ArticleContentData>()
      .exec();

    return doc ?? null;
  }

  async deleteByArticleId(articleId: string): Promise<boolean> {
    const res = await this.model.deleteOne({ articleId }).exec();
    return (res.deletedCount ?? 0) > 0;
  }
}
