import {
  Get,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../../core/auth/auth.types';
import { CurrentUser } from '../../../../core/auth/decorators/current-user.decorator';
import { Public } from '../../../../core/auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../../../core/validator/zod-validation.pipe';
import { UserExamUseCases } from '../domain/user-exam.usecases';
import {
  authorizeExamAccessSchema,
  PaginatedExamQuerySchema,
  publicExamQuerySchema,
  type AuthorizeExamAccessRequestDto,
  type AuthorizeExamAccessResponseDto,
  type PaginatedExamQueryDto,
  type InstitutionExamResponseDto,
  type PaginatedExamResponseDto,
  type PublicExamResponseDto,
  type PublicExamQueryDto,
} from './exam.dto';
// import { Query } from 'mongoose';

@Controller({ path: 'exams', version: '1' })
export class UserExamController {
  constructor(private readonly useCases: UserExamUseCases) {}
  @Get('public')
  @Public()
  async getPublicExams(
    @Query(new ZodValidationPipe(publicExamQuerySchema))
    query: PublicExamQueryDto,
  ): Promise<PaginatedExamResponseDto<PublicExamResponseDto>> {
    return this.useCases.getPublicExams(query);
  }

  @Post(':id/access')
  async authorizeAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(authorizeExamAccessSchema))
    input: AuthorizeExamAccessRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AuthorizeExamAccessResponseDto> {
    return this.useCases.authorizeAccess(
      id,
      currentUser.userId,
      input.invitationToken,
    );
  }

  @Get('institution/:institutionId')
  async getExamsForUsers(
    @Param('institutionId', ParseUUIDPipe)
    institutionId: string,

    @Query(new ZodValidationPipe(PaginatedExamQuerySchema))
    query: PaginatedExamQueryDto,

    @CurrentUser()
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedExamResponseDto<InstitutionExamResponseDto>> {
    return this.useCases.getExams(institutionId, currentUser.userId, query);
  }
}
