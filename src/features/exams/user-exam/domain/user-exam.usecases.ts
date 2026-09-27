import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExamInvitationTokenService } from '../../invitations/exam-invitation-token.service';
import { UserExamRepository } from './user-exam.contracts';

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
    private readonly invitationTokens: ExamInvitationTokenService,
  ) {}

  async authorizeAccess(
    examId: string,
    userId: string,
    invitationToken?: string,
  ): Promise<ExamAccessAuthorization> {
    const exam = await this.repository.findAvailableById(examId);
    if (!exam) throw new NotFoundException('Exam not found.');

    if (exam.accessMode === 'INVITE_ONLY') {
      if (!invitationToken) {
        throw new ForbiddenException('A valid exam invitation is required.');
      }

      try {
        const invitation = await this.invitationTokens.verify(invitationToken);
        if (
          invitation.userId !== userId ||
          invitation.examId !== exam.id ||
          invitation.examScope !== exam.scope
        ) {
          throw new Error('Invitation does not match this request');
        }
      } catch {
        throw new ForbiddenException('A valid exam invitation is required.');
      }
    }

    return {
      authorized: true,
      examId: exam.id,
      scope: exam.scope,
      accessMode: exam.accessMode,
    };
  }
}
