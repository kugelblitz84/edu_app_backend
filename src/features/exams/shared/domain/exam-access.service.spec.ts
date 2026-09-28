import { ForbiddenException } from '@nestjs/common';
import type { ExamInvitationTokenService } from '../../admin-exam/domain/exam-invitation.services';
import type { ExamAccessRepository } from './exam-access.repository';
import { ExamAccessService } from './exam-access.service';

const now = new Date('2026-09-28T10:00:00Z');
const exam = {
  id: 'exam-id',
  name: 'Final',
  scope: 'INSTITUTIONAL' as const,
  accessMode: 'OPEN' as const,
  institutionId: 'institution-id',
  startsAt: new Date('2026-09-28T09:00:00Z'),
  closesAt: new Date('2026-09-28T11:00:00Z'),
  durationMinutes: 60,
  maxAttempts: 1,
  passPercentage: 50,
  contentVersion: 1,
  status: 'RUNNING' as const,
};

describe(ExamAccessService.name, () => {
  it('rejects an institutional candidate without active enrollment', async () => {
    const repository = {
      findExamForAccess: jest.fn().mockResolvedValue(exam),
      hasActiveEnrollment: jest.fn().mockResolvedValue(false),
    } as unknown as ExamAccessRepository;
    const tokens = {
      verify: jest.fn(),
    } as unknown as ExamInvitationTokenService;

    await expect(
      new ExamAccessService(repository, tokens).authorize(
        exam.id,
        'user-id',
        undefined,
        now,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects access outside the authoritative exam window', async () => {
    const repository = {
      findExamForAccess: jest.fn().mockResolvedValue(exam),
      hasActiveEnrollment: jest.fn().mockResolvedValue(true),
    } as unknown as ExamAccessRepository;
    const tokens = {
      verify: jest.fn(),
    } as unknown as ExamInvitationTokenService;

    await expect(
      new ExamAccessService(repository, tokens).authorize(
        exam.id,
        'user-id',
        undefined,
        new Date('2026-09-28T11:00:00Z'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a matching invitation for invite-only exams', async () => {
    const inviteOnly = { ...exam, accessMode: 'INVITE_ONLY' as const };
    const repository = {
      findExamForAccess: jest.fn().mockResolvedValue(inviteOnly),
      hasActiveEnrollment: jest.fn().mockResolvedValue(true),
    } as unknown as ExamAccessRepository;
    const tokens = {
      verify: jest.fn().mockResolvedValue({
        userId: 'user-id',
        examId: exam.id,
        examScope: exam.scope,
      }),
    } as unknown as ExamInvitationTokenService;
    const service = new ExamAccessService(repository, tokens);

    await expect(
      service.authorize(exam.id, 'user-id', undefined, now),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.authorize(exam.id, 'user-id', 'valid-token', now),
    ).resolves.toMatchObject({ accessMode: 'INVITE_ONLY' });
  });
});
