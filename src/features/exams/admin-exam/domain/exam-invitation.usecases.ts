import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  GenerateExamInvitationsRequestDto,
  GenerateExamInvitationsResponseDto,
} from '../presentation/exam-invitation.dto';
import {
  ExamInvitationBulkMailService,
  ExamInvitationTokenService,
} from './exam-invitation.services';
import { ExamRepository } from './exam.repository';

@Injectable()
export class ExamInvitationUseCases {
  constructor(
    private readonly repository: ExamRepository,
    private readonly tokens: ExamInvitationTokenService,
    private readonly mailer: ExamInvitationBulkMailService,
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
    if (exam.createdByUserId !== requestingUserId) {
      throw new ForbiddenException(
        'Only the exam author can invite candidates.',
      );
    }
    if (exam.accessMode !== 'INVITE_ONLY') {
      throw new ConflictException(
        'Invitation tokens can only be generated for invite-only exams.',
      );
    }

    const candidates = await this.repository.findActiveCandidatesByIds(
      input.candidateUserIds,
    );
    if (candidates.length !== input.candidateUserIds.length) {
      throw new BadRequestException(
        'Every candidate must have an active account.',
      );
    }

    const candidatesById = new Map(
      candidates.map((candidate) => [candidate.id, candidate]),
    );
    const invitations = await Promise.all(
      input.candidateUserIds.map(async (userId) => {
        const candidate = candidatesById.get(userId);
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
          userId: candidate.id,
          email: candidate.email,
          token: invitation.token,
          expiresAt: invitation.expiresAt,
        };
      }),
    );

    await this.mailer.sendBulk(
      invitations.map((invitation) => ({
        ...invitation,
        examId,
      })),
    );

    return { examId, invitations };
  }
}
