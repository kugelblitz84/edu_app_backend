import { ForbiddenException } from '@nestjs/common';
import type { ExamInvitationTokenService } from '../../../admin-exam/domain/exam-invitation.services';
import type { ExamAccessRepository } from '../../../shared/domain/exam-access.repository';
import { ExamAccessService } from '../../../shared/domain/exam-access.service';
import { UserExamUseCases } from '../../../user-exam/domain/user-exam.usecases';
import type { UserExamRepository } from '../../../user-exam/domain/user-exam.contracts';
import type { LiveExamRepository } from '../contracts/live-exam.repository';
import type { ExamContentReader } from '../contracts/exam-content.reader';
import { StartAttemptUseCase } from './start-attempt.usecase';

describe('Scheduled exam access', () => {
  const now = new Date('2026-10-14T10:00:00Z');
  const exam = {
    id: 'exam-id',
    name: 'Final',
    scope: 'INSTITUTIONAL' as const,
    accessMode: 'OPEN' as const,
    institutionId: 'institution-id',
    startsAt: new Date('2026-10-14T11:00:00Z'),
    closesAt: new Date('2026-10-14T12:00:00Z'),
    durationMinutes: 60,
    maxAttempts: 1,
    passPercentage: 50,
    contentVersion: 1,
    status: 'SCHEDULED' as const,
  };

  function setup() {
    const repository = {
      findExamForAccess: jest.fn().mockResolvedValue(exam),
      hasActiveEnrollment: jest.fn().mockResolvedValue(true),
    };
    const tokens = { verify: jest.fn() };
    const access = new ExamAccessService(
      repository as unknown as ExamAccessRepository,
      tokens as unknown as ExamInvitationTokenService,
    );
    return { repository, tokens, access };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });
  afterEach(() => jest.useRealTimers());

  it('returns the schedule from access authorization', async () => {
    const { access } = setup();
    const useCases = new UserExamUseCases({} as UserExamRepository, access);
    await expect(useCases.authorizeAccess(exam.id, 'user-id')).resolves.toEqual(
      {
        authorized: false,
        examId: exam.id,
        status: 'SCHEDULED',
        startsAt: exam.startsAt,
        message:
          'The exam has not started yet. Please return at the scheduled start time.',
      },
    );
  });

  it('returns the schedule without creating an attempt or reading questions', async () => {
    const { access } = setup();
    const repository = { startOrResume: jest.fn() };
    const content = { getCandidateQuestions: jest.fn() };
    const useCase = new StartAttemptUseCase(
      access,
      repository as unknown as LiveExamRepository,
      content as unknown as ExamContentReader,
    );
    await expect(
      useCase.execute(exam.id, 'user-id', undefined, {}),
    ).resolves.toMatchObject({ authorized: false, startsAt: exam.startsAt });
    expect(repository.startOrResume).not.toHaveBeenCalled();
    expect(content.getCandidateQuestions).not.toHaveBeenCalled();
  });

  it('still checks enrollment before returning a schedule', async () => {
    const { access, repository } = setup();
    repository.hasActiveEnrollment.mockResolvedValue(false);
    await expect(access.authorize(exam.id, 'user-id')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('still requires an invitation before returning an invite-only schedule', async () => {
    const { access, repository } = setup();
    repository.findExamForAccess.mockResolvedValue({
      ...exam,
      accessMode: 'INVITE_ONLY',
    } as typeof exam);
    await expect(access.authorize(exam.id, 'user-id')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('starts normally at the exact scheduled time', async () => {
    jest.setSystemTime(exam.startsAt);
    const { access } = setup();
    const repository = {
      startOrResume: jest.fn().mockResolvedValue({
        examId: exam.id,
        contentVersion: 1,
        startedAt: exam.startsAt,
      }),
    };
    const content = { getCandidateQuestions: jest.fn().mockResolvedValue([]) };
    const useCase = new StartAttemptUseCase(
      access,
      repository as unknown as LiveExamRepository,
      content as unknown as ExamContentReader,
    );
    await expect(
      useCase.execute(exam.id, 'user-id', undefined, {}),
    ).resolves.toMatchObject({ questions: [] });
    expect(repository.startOrResume).toHaveBeenCalled();
  });
});
