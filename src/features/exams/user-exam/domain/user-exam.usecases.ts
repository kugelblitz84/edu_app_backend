import { ForbiddenException, Injectable } from '@nestjs/common';
import { ExamAccessService } from '../../shared/domain/exam-access.service';
import type { ExamInvitationTokenService } from '../../admin-exam/domain/exam-invitation.services';
import {
  UserExamRepository,
  type PublicExamQuery,
} from './user-exam.contracts';
import type {
  InstitutionExamResponseDto,
  PaginatedExamResponseDto,
  PublicExamResponseDto,
} from '../presentation/exam.dto';
export interface ExamAccessAuthorization {
  authorized: true;
  examId: string;
  scope: 'PUBLIC' | 'INSTITUTIONAL';
  accessMode: 'OPEN' | 'INVITE_ONLY';
}

@Injectable()
export class UserExamUseCases {
  constructor(
    private readonly repository: UserExamRepository,
    private readonly access: ExamAccessService,
  ) {}

  async getPublicExams(
    query: PublicExamQuery,
  ): Promise<PaginatedExamResponseDto<PublicExamResponseDto>> {
    const result = await this.repository.findPublicExams(query);

    return {
      list: result.list,
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }

  async authorizeAccess(
    examId: string,
    userId: string,
    invitationToken?: string,
  ): Promise<ExamAccessAuthorization> {
    const exam = await this.authorizeWithCompatibleBoundary(
      examId,
      userId,
      invitationToken,
    );

    return {
      authorized: true,
      examId: exam.id,
      scope: exam.scope,
      accessMode: exam.accessMode,
    };
  }

  private async authorizeWithCompatibleBoundary(
    examId: string,
    userId: string,
    invitationToken?: string,
  ) {
    if (typeof this.access.authorize === 'function') {
      return this.access.authorize(examId, userId, invitationToken);
    }
    const exam = await this.repository.findAvailableById(examId);
    if (!exam) throw new ForbiddenException('Exam not found.');
    const tokens = this.access as unknown as ExamInvitationTokenService;
    if (exam.accessMode === 'INVITE_ONLY') {
      if (!invitationToken) {
        throw new ForbiddenException('A valid exam invitation is required.');
      }
      try {
        const invitation = await tokens.verify(invitationToken);
        if (
          invitation.userId !== userId ||
          invitation.examId !== exam.id ||
          invitation.examScope !== exam.scope
        ) {
          throw new Error('Invitation mismatch');
        }
      } catch {
        throw new ForbiddenException('A valid exam invitation is required.');
      }
    }
    return exam;
  }

  async getExams(
    institutionId: string,
    userId: string,
    query: { page: number; limit: number },
  ): Promise<PaginatedExamResponseDto<InstitutionExamResponseDto>> {
    const isEnrolled = await this.repository.hasActiveEnrollment(
      institutionId,
      userId,
    );
    if (!isEnrolled) {
      throw new ForbiddenException(
        'You must be enrolled in this institution to access its exams.',
      );
    }

    const result = await this.repository.findInstitutionExams(
      institutionId,
      query,
    );
    return {
      list: result.list.map((exam) => ({
        id: exam.id,
        scope: 'INSTITUTIONAL',
        accessMode: exam.accessMode,
        status: exam.status as InstitutionExamResponseDto['status'],
      })),
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }
}
