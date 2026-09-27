import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExamInvitationTokenService } from '../../invitations/exam-invitation-token.service';
import type {
  GenerateExamInvitationsRequestDto,
  GenerateExamInvitationsResponseDto,
} from '../presentation/exam-invitation.dto';
import { ExamRepository } from './exam.repository';

@Injectable()
export class ExamInvitationUseCases {
  constructor(
    private readonly repository: ExamRepository,
    private readonly tokens: ExamInvitationTokenService,
  ) {}

  async generate(
    examId: string,
    requestingUserId: string,
    input: GenerateExamInvitationsRequestDto,
  ): Promise<GenerateExamInvitationsResponseDto> {
    const exam = await this.repository.findAccessibleById(
      examId,
      requestingUserId,
    );
    if (!exam) throw new NotFoundException('Exam not found.');
    if (exam.accessMode !== 'INVITE_ONLY') {
      throw new ConflictException(
        'Invitation tokens can only be generated for invite-only exams.',
      );
    }

    const candidates = await this.repository.findActiveCandidatesByEmails(
      input.candidateEmails,
    );
    if (candidates.length !== input.candidateEmails.length) {
      throw new BadRequestException(
        'Every candidate must have an active account.',
      );
    }

    const candidatesByEmail = new Map(
      candidates.map((candidate) => [candidate.email.toLowerCase(), candidate]),
    );
    const invitations = await Promise.all(
      input.candidateEmails.map(async (email) => {
        const candidate = candidatesByEmail.get(email);
        if (!candidate) {
          throw new BadRequestException(
            'Every candidate must have an active account.',
          );
        }
        const invitation = await this.tokens.generate({
          examId,
          examScope: exam.scope,
          userId: candidate.id,
        });
        return {
          email: candidate.email,
          token: invitation.token,
          expiresAt: invitation.expiresAt,
        };
      }),
    );

    return { examId, invitations };
  }
}
