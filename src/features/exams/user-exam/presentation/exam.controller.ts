import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../../core/auth/auth.types';
import { CurrentUser } from '../../../../core/auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../core/validator/zod-validation.pipe';
import { UserExamUseCases } from '../domain/user-exam.usecases';
import {
  authorizeExamAccessSchema,
  type AuthorizeExamAccessRequestDto,
  type AuthorizeExamAccessResponseDto,
} from './exam.dto';

@Controller({ path: 'exams', version: '1' })
export class UserExamController {
  constructor(private readonly useCases: UserExamUseCases) {}

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
}
