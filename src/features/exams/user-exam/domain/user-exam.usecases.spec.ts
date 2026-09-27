import { ForbiddenException } from '@nestjs/common';
import type { ExamInvitationTokenService } from '../../admin-exam/domain/exam-invitation.services';
import { UserExamRepository } from './user-exam.contracts';
import { UserExamUseCases } from './user-exam.usecases';

const exam = {
  id: '8dc198a1-1b0f-4fc1-914d-319917301f3e',
  scope: 'PUBLIC' as const,
  accessMode: 'INVITE_ONLY' as const,
  status: 'SCHEDULED' as const,
};
const userId = '2f273fc1-674b-4763-972c-16a87eb8a616';

function useCasesMock() {
  const findAvailableById = jest.fn();
  const verify = jest.fn();
  const repository = {
    findAvailableById,
  } as unknown as UserExamRepository;
  const tokens = { verify } as unknown as ExamInvitationTokenService;
  return {
    useCases: new UserExamUseCases(repository, tokens),
    findAvailableById,
    verify,
  };
}

describe(UserExamUseCases.name, () => {
  it('allows an open exam without an invitation token', async () => {
    const { useCases, findAvailableById, verify } = useCasesMock();
    findAvailableById.mockResolvedValue({ ...exam, accessMode: 'OPEN' });

    await expect(
      useCases.authorizeAccess(exam.id, userId),
    ).resolves.toMatchObject({ authorized: true, accessMode: 'OPEN' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('allows an invited user into an invite-only exam', async () => {
    const { useCases, findAvailableById, verify } = useCasesMock();
    findAvailableById.mockResolvedValue(exam);
    verify.mockResolvedValue({
      userId,
      examId: exam.id,
      examScope: exam.scope,
    });

    await expect(
      useCases.authorizeAccess(exam.id, userId, 'invitation-token'),
    ).resolves.toMatchObject({ authorized: true, accessMode: 'INVITE_ONLY' });
  });

  it('rejects a valid invitation belonging to another user', async () => {
    const { useCases, findAvailableById, verify } = useCasesMock();
    findAvailableById.mockResolvedValue(exam);
    verify.mockResolvedValue({
      userId: 'different-user-id',
      examId: exam.id,
      examScope: exam.scope,
    });

    await expect(
      useCases.authorizeAccess(exam.id, userId, 'invitation-token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
