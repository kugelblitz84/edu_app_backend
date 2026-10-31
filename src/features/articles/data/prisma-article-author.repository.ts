import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  ArticleAuthorRepository,
  type ArticleAuthor,
} from '../domain/article.repository';

@Injectable()
export class PrismaArticleAuthorRepository extends ArticleAuthorRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findById(userId: string): Promise<ArticleAuthor | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, fullName: true },
    });
  }
}
