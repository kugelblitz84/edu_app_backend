import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../../core/auth/auth.types';
import { CurrentUser } from '../../../../core/auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../core/validator/zod-validation.pipe';
import { GetAttemptResultUseCase } from '../domain/usecases/get-attempt-result.usecase';
import { RecoverAttemptUseCase } from '../domain/usecases/recover-attempt.usecase';
import { StartAttemptUseCase } from '../domain/usecases/start-attempt.usecase';
import { SubmitAttemptUseCase } from '../domain/usecases/submit-attempt.usecase';
import { startAttemptSchema, type StartAttemptDto } from './live-exam.dto';

@Controller({ path: 'exams', version: '1' })
export class StartExamAttemptController {
  constructor(private readonly startAttempt: StartAttemptUseCase) {}

  @Post(':examId/attempts')
  start(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body(new ZodValidationPipe(startAttemptSchema)) input: StartAttemptDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.startAttempt.execute(
      examId,
      user.userId,
      input.invitationToken,
      {
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      },
    );
  }
}

@Controller({ path: 'exam-attempts', version: '1' })
export class LiveExamController {
  constructor(
    private readonly recoverAttempt: RecoverAttemptUseCase,
    private readonly submitAttempt: SubmitAttemptUseCase,
    private readonly getResult: GetAttemptResultUseCase,
  ) {}

  @Get(':attemptId')
  recover(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recoverAttempt.execute(attemptId, user.userId);
  }

  @Post(':attemptId/submit')
  submit(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submitAttempt.execute(attemptId, user.userId);
  }

  @Get(':attemptId/result')
  result(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getResult.execute(attemptId, user.userId);
  }
}
