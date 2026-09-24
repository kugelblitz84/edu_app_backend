import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import type { ReviewPageOptions } from '../domain/contracts/types';
import type { GlobalAdminRequest } from './global-admin-auth.middleware';
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
    @Req() request: GlobalAdminRequest,
  ): Promise<ApprovedOrRejectedByMeResponseDto> {
    const result = await this.useCases.getRespondedBy(
      request.globalAdminUserId,
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
    @Req() request: GlobalAdminRequest,
  ): Promise<InstitutionDecisionResponseDto> {
    const result = await this.useCases.respond(id, request.globalAdminUserId, {
      verdict: decision.status,
      rejectReason: decision.rejectReason,
      notes: decision.notes,
    });
    return toDecisionResponse(result);
  }
}
