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
import { ArticleUseCases } from '../../articles/domain/article.usecases';
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
  constructor(private readonly useCases: ArticleUseCases) {}

  @Get('pending')
  async getPending(
    @Query(new ZodValidationPipe(adminArticleQuerySchema))
    query: AdminArticleQueryDto,
  ) {
    return this.useCases.getPendingArticles(query);
  }

  @Get('responded-by-me')
  async getRespondedByMe(
    @Query(new ZodValidationPipe(adminRespondedQuerySchema))
    query: AdminRespondedQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.useCases.getRespondedByMe(currentUser.userId, query);
  }

  @Get(':id')
  async getDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.useCases.getArticleForAdminReview(id);
  }

  @Patch(':id/respond')
  async respond(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(adminArticleReviewSchema))
    body: AdminArticleReviewDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.useCases.reviewArticle(currentUser, id, body);
  }
}
