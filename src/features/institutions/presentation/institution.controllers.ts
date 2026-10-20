import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { Public } from '../../../core/auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import { InstitutionUseCases } from '../domain/institution.usecases';
import {
  dummyPaymentSchema,
  enrollRequestSchema,
  listInstitutionsQuerySchema,
  reviewEnrollmentSchema,
  toEnrollmentResponseDto,
  toInstitutionSummaryDto,
  toPendingEnrollmentResponseDto,
  type DummyPaymentDto,
  type EnrollRequestDto,
  type EnrollmentResponseDto,
  type InstitutionListResponseDto,
  type InstitutionSummaryResponseDto,
  type ListInstitutionsQueryDto,
  type PendingEnrollmentRequestResponseDto,
  type ReviewEnrollmentDto,
  type UserEnrollmentStatusResponseDto,
} from './institutions.dto';

@Controller({ path: 'institutions', version: '1' })
export class InstitutionController {
  constructor(private readonly useCases: InstitutionUseCases) {}

  @Public()
  @Get()
  async list(
    @Query(new ZodValidationPipe(listInstitutionsQuerySchema))
    query: ListInstitutionsQueryDto,
  ): Promise<InstitutionListResponseDto> {
    const page = await this.useCases.listInstitutions(query);
    return {
      list: page.list.map(toInstitutionSummaryDto),
      total: page.total,
      page: page.page,
      limit: page.limit,
    };
  }

  @Public()
  @Get(':id')
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InstitutionSummaryResponseDto> {
    const institution = await this.useCases.getInstitution(id);
    return toInstitutionSummaryDto(institution);
  }

  @Post(':id/enroll')
  async enroll(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body(new ZodValidationPipe(enrollRequestSchema))
    body: EnrollRequestDto,
  ): Promise<EnrollmentResponseDto> {
    const result = await this.useCases.enroll(id, currentUser, body);
    return toEnrollmentResponseDto(result);
  }

  @Post(':id/enroll/dummy-pay')
  async processDummyPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body(new ZodValidationPipe(dummyPaymentSchema))
    body: DummyPaymentDto,
  ): Promise<EnrollmentResponseDto> {
    const result = await this.useCases.processDummyPayment(
      id,
      currentUser,
      body,
    );
    return toEnrollmentResponseDto(result);
  }

  @Get(':id/enrollment')
  getEnrollmentStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserEnrollmentStatusResponseDto> {
    return this.useCases.getEnrollmentStatus(id, currentUser.userId);
  }

  @Get(':id/enrollment-requests')
  async listPendingEnrollmentRequests(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PendingEnrollmentRequestResponseDto[]> {
    const requests = await this.useCases.listPendingEnrollments(
      id,
      currentUser,
    );
    return requests.map(toPendingEnrollmentResponseDto);
  }

  @Patch(':id/enrollment-requests/:userId')
  async reviewEnrollmentRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body(new ZodValidationPipe(reviewEnrollmentSchema))
    decision: ReviewEnrollmentDto,
  ): Promise<EnrollmentResponseDto> {
    const result = await this.useCases.reviewEnrollmentRequest(
      id,
      targetUserId,
      currentUser,
      decision,
    );
    return toEnrollmentResponseDto(result);
  }
}

