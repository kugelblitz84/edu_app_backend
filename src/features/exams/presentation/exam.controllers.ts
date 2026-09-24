import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import { ExamUseCases } from '../domain/exam.usecases';
import {
  createExamSchema,
  scheduleExamSchema,
  updateExamContentSchema,
  updateExamMetadataSchema,
  type CreateExamRequestDto,
  type ExamContentResponseDto,
  type ExamResponseDto,
  type ScheduleExamRequestDto,
  type UpdateExamContentRequestDto,
  type UpdateExamMetadataRequestDto,
} from './exam.dto';

@Controller({ path: 'exams', version: '1' })
export class ExamController {
  constructor(private readonly useCases: ExamUseCases) {}

  @Post('/create')
  async create(
    @Body(new ZodValidationPipe(createExamSchema)) input: CreateExamRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.useCases.createDraft(currentUser.userId, input);
  }

  @Patch(':id/schedule')
  async schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(scheduleExamSchema))
    input: ScheduleExamRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.useCases.schedule(id, currentUser.userId, input);
  }

  @Patch(':id/metadata')
  async updateMetadata(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateExamMetadataSchema))
    input: UpdateExamMetadataRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ExamResponseDto> {
    return this.useCases.updateMetadata(id, currentUser.userId, input);
  }

  @Patch(':id/content')
  async updateContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateExamContentSchema))
    input: UpdateExamContentRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ExamContentResponseDto> {
    return this.useCases.updateContent(id, currentUser.userId, input);
  }
}
