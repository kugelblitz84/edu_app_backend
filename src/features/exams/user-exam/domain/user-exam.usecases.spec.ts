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
  const hasActiveEnrollment = jest.fn();
  const findInstitutionExams = jest.fn();
  const findPublicExams = jest.fn();
  const verify = jest.fn();
  const repository = {
    findAvailableById,
    hasActiveEnrollment,
    findInstitutionExams,
    findPublicExams,
  } as unknown as UserExamRepository;
  const tokens = { verify } as unknown as ExamInvitationTokenService;
  return {
    useCases: new UserExamUseCases(repository, tokens),
    findAvailableById,
    hasActiveEnrollment,
    findInstitutionExams,
    findPublicExams,
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

  it('returns institution exams for an actively enrolled user', async () => {
    const { useCases, hasActiveEnrollment, findInstitutionExams } =
      useCasesMock();
    const institutionId = '1030af05-ed3a-4327-8c99-17acc15f2eb6';
    const institutionExam = { ...exam, scope: 'INSTITUTIONAL' as const };
    hasActiveEnrollment.mockResolvedValue(true);
    findInstitutionExams.mockResolvedValue({
      list: [institutionExam],
      total: 12,
    });

    await expect(
      useCases.getExams(institutionId, userId, { page: 1, limit: 10 }),
    ).resolves.toEqual({
      list: [institutionExam],
      page: 1,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
    expect(findInstitutionExams).toHaveBeenCalledWith(institutionId, {
      page: 1,
      limit: 10,
    });
  });

  it('rejects a user who is not actively enrolled', async () => {
    const { useCases, hasActiveEnrollment, findInstitutionExams } =
      useCasesMock();
    const institutionId = '1030af05-ed3a-4327-8c99-17acc15f2eb6';
    hasActiveEnrollment.mockResolvedValue(false);

    await expect(
      useCases.getExams(institutionId, userId, { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findInstitutionExams).not.toHaveBeenCalled();
  });

  it('returns public exams with pagination metadata', async () => {
    const { useCases, findPublicExams } = useCasesMock();
    const query = {
      page: 2,
      limit: 5,
      status: 'RUNNING' as const,
      prefix: 'Math',
      orderBy: 'name' as const,
      order: 'asc' as const,
    };
    const publicExam = {
      id: exam.id,
      name: 'Mathematics Final',
      description: null,
      startsAt: new Date('2026-10-01T10:00:00Z'),
      closesAt: new Date('2026-10-01T12:00:00Z'),
      durationMinutes: 60,
      status: 'RUNNING' as const,
      accessMode: 'OPEN' as const,
      createdAt: new Date('2026-09-01T10:00:00Z'),
      updatedAt: new Date('2026-09-02T10:00:00Z'),
    };
    findPublicExams.mockResolvedValue({ list: [publicExam], total: 12 });

    await expect(useCases.getPublicExams(query)).resolves.toEqual({
      list: [publicExam],
      page: 2,
      limit: 5,
      total: 12,
      totalPages: 3,
    });
    expect(findPublicExams).toHaveBeenCalledWith(query);
  });
});
