import type { ExamInvitationTokenService } from '../../invitations/exam-invitation-token.service';
import { ExamInvitationUseCases } from './exam-invitation.usecases';
import type { ExamRepository } from './exam.repository';

const exam = {
  id: '8dc198a1-1b0f-4fc1-914d-319917301f3e',
  scope: 'INSTITUTIONAL' as const,
  institutionId: 'ed52b4d1-b69a-4705-bd3f-f946170a4813',
  name: 'Final',
  description: null,
  examDate: null,
  durationMinutes: null,
  status: 'DRAFT' as const,
  accessMode: 'INVITE_ONLY' as const,
  createdByUserId: '2f273fc1-674b-4763-972c-16a87eb8a616',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe(ExamInvitationUseCases.name, () => {
  it('generates a candidate-bound token for an invite-only exam', async () => {
    const candidate = {
      id: '9c45926e-fab7-4873-b219-02330fba39b8',
      email: 'candidate@example.com',
    };
    const repository = {
      findAccessibleById: jest.fn().mockResolvedValue(exam),
      findActiveCandidatesByEmails: jest.fn().mockResolvedValue([candidate]),
    } as unknown as ExamRepository;
    const expiresAt = new Date('2026-10-01T00:00:00Z');
    const generate = jest.fn().mockResolvedValue({
      userId: candidate.id,
      examId: exam.id,
      examScope: exam.scope,
      token: 'invitation-token',
      expiresAt,
    });
    const tokens = { generate } as unknown as ExamInvitationTokenService;
    const useCases = new ExamInvitationUseCases(repository, tokens);

    await expect(
      useCases.generate(exam.id, exam.createdByUserId, {
        candidateEmails: [candidate.email],
      }),
    ).resolves.toEqual({
      examId: exam.id,
      invitations: [
        { email: candidate.email, token: 'invitation-token', expiresAt },
      ],
    });
    expect(generate).toHaveBeenCalledWith({
      userId: candidate.id,
      examId: exam.id,
      examScope: exam.scope,
    });
  });
});
