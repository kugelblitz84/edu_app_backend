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
  type CreateExamRequestDto,
  type ExamResponseDto,
  type ScheduleExamRequestDto,
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
}
