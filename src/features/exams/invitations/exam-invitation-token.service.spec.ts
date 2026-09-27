import type { AppConfig } from '../../../core/config/app-config';
import { ExamInvitationTokenService } from './exam-invitation-token.service';

const config = {
  auth: {
    examInvitationTokenSecret:
      'test-exam-invitation-secret-at-least-32-characters',
    examInvitationTokenTtlSeconds: 3600,
    issuer: 'edu-app-api',
  },
} as unknown as AppConfig;

describe(ExamInvitationTokenService.name, () => {
  const service = new ExamInvitationTokenService(config);
  const subject = {
    userId: '2f273fc1-674b-4763-972c-16a87eb8a616',
    examId: '8dc198a1-1b0f-4fc1-914d-319917301f3e',
    examScope: 'PUBLIC' as const,
  };

  it('generates a unique token bound to the candidate and exam', async () => {
    const first = await service.generate(subject);
    const second = await service.generate(subject);

    expect(first.token).not.toBe(second.token);
    await expect(service.verify(first.token)).resolves.toEqual(subject);
  });

  it('rejects a tampered invitation token', async () => {
    const invitation = await service.generate(subject);
    const tampered = `${invitation.token}x`;

    await expect(service.verify(tampered)).rejects.toThrow();
  });
});
