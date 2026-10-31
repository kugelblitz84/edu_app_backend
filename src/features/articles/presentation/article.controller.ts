import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { OptionalAuth } from '../../../core/auth/decorators/optional-auth.decorator';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import { ArticleUseCases } from '../domain/article.usecases';
import {
  articleQuerySchema,
  createArticleSchema,
  unlockArticleSchema,
  updateArticleSchema,
  type ArticleQueryDto,
  type CreateArticleDto,
  type UnlockArticleDto,
  type UpdateArticleDto,
} from './article.dto';

@Controller({ path: 'articles', version: '1' })
export class ArticleController {
  constructor(private readonly useCases: ArticleUseCases) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(createArticleSchema)) input: CreateArticleDto,
  ) {
    return this.useCases.createDraft(actor, input);
  }

  @Patch(':id')
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateArticleSchema)) input: UpdateArticleDto,
  ) {
    return this.useCases.updateDraft(actor, id, input);
  }

  @Post(':id/submit-for-review')
  @HttpCode(HttpStatus.OK)
  async submitForReview(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.useCases.submitForReview(actor, id);
  }

  @Get('me')
  async getMyArticles(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, Number.parseInt(limit, 10) || 20),
    );
    return this.useCases.getMyArticles(actor, {
      page: pageNum,
      limit: limitNum,
    });
  }

  @OptionalAuth()
  @Get()
  async getPublished(
    @Query(new ZodValidationPipe(articleQuerySchema)) query: ArticleQueryDto,
  ) {
    return this.useCases.getPublishedArticles(query);
  }

  @OptionalAuth()
  @Get(':id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.useCases.getArticleDetail(id, actor?.userId);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  async unlock(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(unlockArticleSchema)) input: UnlockArticleDto,
  ) {
    return this.useCases.unlockArticle(actor, id, input.pin);
  }
}
