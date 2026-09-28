import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExamInvitationTokenService } from '../../admin-exam/domain/exam-invitation.services';
import {
  ExamAccessRepository,
  type AccessibleExam,
} from './exam-access.repository';

@Injectable()
export class ExamAccessService {
  constructor(
    private readonly repository: ExamAccessRepository,
    private readonly invitationTokens: ExamInvitationTokenService,
  ) {}

  async authorize(
    examId: string,
    userId: string,
    invitationToken?: string,
    now = new Date(),
  ): Promise<AccessibleExam> {
    const exam = await this.repository.findExamForAccess(examId);
    if (!exam) throw new NotFoundException('Exam not found.');
    if (
      exam.status === 'CANCELLED' ||
      !exam.startsAt ||
      !exam.closesAt ||
      !exam.durationMinutes ||
      exam.contentVersion < 1 ||
      now < exam.startsAt ||
      now >= exam.closesAt
    ) {
      throw new ForbiddenException('The exam is not currently available.');
    }

    if (
      exam.scope === 'INSTITUTIONAL' &&
      (!exam.institutionId ||
        !(await this.repository.hasActiveEnrollment(
          exam.institutionId,
          userId,
        )))
    ) {
      throw new ForbiddenException(
        'You must be enrolled in this institution to access its exams.',
      );
    }

    if (exam.accessMode === 'INVITE_ONLY') {
      if (!invitationToken) this.invalidInvitation();
      try {
        const invitation = await this.invitationTokens.verify(invitationToken);
        if (
          invitation.userId !== userId ||
          invitation.examId !== exam.id ||
          invitation.examScope !== exam.scope
        ) {
          this.invalidInvitation();
        }
      } catch {
        this.invalidInvitation();
      }
    }
    return exam;
  }

  private invalidInvitation(): never {
    throw new ForbiddenException('A valid exam invitation is required.');
  }
}
