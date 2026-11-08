import { Module } from '@nestjs/common';
import { MongooseModule } from '../../core/database/mongoose.module';
import { PrismaModule } from '../../core/database/prisma.module';
import { ScryptSecretHasher } from '../../core/security/scrypt-secret-hasher.service';
import { ScryptSecretVerifier } from '../../core/security/scrypt-secret-verifier.service';
import { MongoArticleContentRepository } from './data/mongo-article-content.repository';
import { PrismaArticleAuthorRepository } from './data/prisma-article-author.repository';
import { PrismaArticleRepository } from './data/prisma-article.repository';
import {
  ArticleAuthorRepository,
  ArticleContentRepository,
  ArticleRepository,
} from './domain/article.repository-contract';
import { ArticleUseCases } from './domain/article.usecases';
import { ArticleController } from './presentation/article.controller';

@Module({
  imports: [MongooseModule, PrismaModule],
  providers: [
    ArticleUseCases,
    PrismaArticleRepository,
    MongoArticleContentRepository,
    PrismaArticleAuthorRepository,
    { provide: ArticleRepository, useExisting: PrismaArticleRepository },
    {
      provide: ArticleContentRepository,
      useExisting: MongoArticleContentRepository,
    },
    {
      provide: ArticleAuthorRepository,
      useExisting: PrismaArticleAuthorRepository,
    },
    ScryptSecretHasher,
    ScryptSecretVerifier,
  ],
  controllers: [ArticleController],
  exports: [ArticleUseCases],
})
export class ArticleModule {}
