import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import { ArticleService } from '../../articles/domain/article.service';
import {
  adminArticleQuerySchema,
  adminArticleReviewSchema,
  adminRespondedQuerySchema,
  type AdminArticleQueryDto,
  type AdminArticleReviewDto,
  type AdminRespondedQueryDto,
} from '../../articles/presentation/article.dto';

@Controller({ path: 'global-admin/articles', version: '1' })
@Roles('GLOBAL_ADMIN')
export class GlobalAdminArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get('pending')
  async getPending(
    @Query(new ZodValidationPipe(adminArticleQuerySchema))
    query: AdminArticleQueryDto,
  ) {
    return this.articleService.getPendingArticles(query);
  }

  @Get('responded-by-me')
  async getRespondedByMe(
    @Query(new ZodValidationPipe(adminRespondedQuerySchema))
    query: AdminRespondedQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.articleService.getRespondedByMe(currentUser.userId, query);
  }

  @Get(':id')
  async getDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.articleService.getArticleForAdminReview(id);
  }

  @Patch(':id/respond')
  async respond(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(adminArticleReviewSchema))
    body: AdminArticleReviewDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.articleService.reviewArticle(currentUser, id, body);
  }
}
