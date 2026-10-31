import { Module } from '@nestjs/common';
import { MongooseModule } from '../../core/database/mongoose.module';
import { PrismaModule } from '../../core/database/prisma.module';
import { ScryptSecretHasher } from '../../core/security/scrypt-secret-hasher.service';
import { ScryptSecretVerifier } from '../../core/security/scrypt-secret-verifier.service';
import { MongoArticleRepository } from './data/mongo-article.repository';
import { ArticleService } from './domain/article.service';
import { ArticleController } from './presentation/article.controller';

@Module({
  imports: [MongooseModule, PrismaModule],
  providers: [
    ArticleService,
    MongoArticleRepository,
    ScryptSecretHasher,
    ScryptSecretVerifier,
  ],
  controllers: [ArticleController],
  exports: [ArticleService, MongoArticleRepository],
})
export class ArticleModule {}
