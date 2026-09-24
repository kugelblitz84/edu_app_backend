import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { Role } from '../../../core/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import type { ReviewPageOptions } from '../domain/contracts/types';
import { GlobalAdminUseCases } from '../domain/usecases';
import {
  approvalResponseSchema,
  institutionReviewQuerySchema,
  respondedReviewQuerySchema,
  toDecisionResponse,
  type ApprovedOrRejectedByMeResponseDto,
  type ApprovalResponseInstitutionRequestDto,
  type InstitutionDecisionResponseDto,
  type PendingInstitutionApprovalResponseDto,
} from './global-admin.dto';

@Controller({ path: 'global-admin/institutions', version: '1' })
@Role('GLOBAL_ADMIN')
export class GlobalAdminController {
  constructor(private readonly useCases: GlobalAdminUseCases) {}

  @Get('pending')
  async getPending(
    @Query(new ZodValidationPipe(institutionReviewQuerySchema))
    options: ReviewPageOptions,
  ): Promise<PendingInstitutionApprovalResponseDto> {
    const result = await this.useCases.getPending(options);
    return {
      list: result.list.map((row) => ({
        id: row.id,
        name: row.name,
        logo_url: row.logoUrl,
        requestedByUserId: row.createdByUserId,
        createdAt: row.createdAt,
      })),
      page: options.page,
      limit: options.limit,
      total: result.total,
    };
  }

  @Get('responded-by-me')
  async getRespondedByMe(
    @Query(new ZodValidationPipe(respondedReviewQuerySchema))
    options: ReviewPageOptions,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ApprovedOrRejectedByMeResponseDto> {
    const result = await this.useCases.getRespondedBy(
      currentUser.userId,
      options,
    );
    return {
      list: result.list.map((row) => ({
        id: row.id,
        verdict: row.reviewVerdict!,
        name: row.name,
        logo_url: row.logoUrl,
        respondedAt: row.respondedAt!,
        rejectReason: row.rejectReason,
      })),
      page: options.page,
      limit: options.limit,
      total: result.total,
    };
  }

  @Patch(':id/respond')
  async respond(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(approvalResponseSchema))
    decision: ApprovalResponseInstitutionRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<InstitutionDecisionResponseDto> {
    const result = await this.useCases.respond(id, currentUser.userId, {
      verdict: decision.status,
      rejectReason: decision.rejectReason,
      notes: decision.notes,
    });
    return toDecisionResponse(result);
  }
}
