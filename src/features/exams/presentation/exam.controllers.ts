import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import { ExamUseCases } from '../domain/exam.usecases';
import type { AuthenticatedExamRequest } from './exam-auth.middleware';
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
    @Req() request: AuthenticatedExamRequest,
  ): Promise<ExamResponseDto> {
    return this.useCases.createDraft(request.userId, input);
  }

  @Patch(':id/schedule')
  async schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(scheduleExamSchema))
    input: ScheduleExamRequestDto,
    @Req() request: AuthenticatedExamRequest,
  ): Promise<ExamResponseDto> {
    return this.useCases.schedule(id, request.userId, input);
  }

  @Patch(':id/metadata')
  async updateMetadata(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateExamMetadataSchema))
    input: UpdateExamMetadataRequestDto,
    @Req() request: AuthenticatedExamRequest,
  ): Promise<ExamResponseDto> {
    return this.useCases.updateMetadata(id, request.userId, input);
  }

  @Patch(':id/content')
  async updateContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateExamContentSchema))
    input: UpdateExamContentRequestDto,
    @Req() request: AuthenticatedExamRequest,
  ): Promise<ExamContentResponseDto> {
    return this.useCases.updateContent(id, request.userId, input);
  }
}
