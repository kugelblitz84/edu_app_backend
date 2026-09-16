import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import type { ReviewPageOptions } from '../domain/contracts/repositories';
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
    @Query() query: Record<string, unknown>,
  ): Promise<PendingInstitutionApprovalResponseDto> {
    const options = this.parseQuery(query);
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
    @Query() query: Record<string, unknown>,
    @Req() request: GlobalAdminRequest,
  ): Promise<ApprovedOrRejectedByMeResponseDto> {
    const options = this.parseQuery(query, respondedReviewQuerySchema);
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
    @Body() body: unknown,
    @Req() request: GlobalAdminRequest,
  ): Promise<InstitutionDecisionResponseDto> {
    const parsed = approvalResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid institution decision.',
        violations: parsed.error.issues.map((issue) => issue.message),
      });
    }
    const decision: ApprovalResponseInstitutionRequestDto = parsed.data;
    const result = await this.useCases.respond(id, request.globalAdminUserId, {
      verdict: decision.status,
      rejectReason: decision.rejectReason,
      notes: decision.notes,
    });
    return toDecisionResponse(result);
  }

  @Patch(':id/approve')
  async approveInstitution(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: GlobalAdminRequest,
  ): Promise<InstitutionDecisionResponseDto> {
    return toDecisionResponse(
      await this.useCases.respond(id, request.globalAdminUserId, {
        verdict: 'APPROVED',
      }),
    );
  }

  private parseQuery(
    query: Record<string, unknown>,
    schema: z.ZodType<ReviewPageOptions> = institutionReviewQuerySchema,
  ): ReviewPageOptions {
    const parsed = schema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid pagination or filter query.',
        violations: parsed.error.issues.map((issue) => issue.message),
      });
    }
    return parsed.data;
  }
}
