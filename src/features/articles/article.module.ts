import { Module } from '@nestjs/common';
import { MongooseModule } from '../../core/database/mongoose.module';
import { PrismaModule } from '../../core/database/prisma.module';
import { ScryptSecretHasher } from '../../core/security/scrypt-secret-hasher.service';
import { ScryptSecretVerifier } from '../../core/security/scrypt-secret-verifier.service';
import { MongoArticleRepository } from './data/mongo-article.repository';
import { PrismaArticleAuthorRepository } from './data/prisma-article-author.repository';
import {
  ArticleRepository,
  ArticleAuthorRepository,
} from './domain/article.repository';
import { ArticleUseCases } from './domain/article.usecases';
import { ArticleController } from './presentation/article.controller';

@Module({
  imports: [MongooseModule, PrismaModule],
  providers: [
    ArticleUseCases,
    MongoArticleRepository,
    PrismaArticleAuthorRepository,
    { provide: ArticleRepository, useExisting: MongoArticleRepository },
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
