import { generateExamInvitationsSchema } from './exam-invitation.dto';

describe('exam invitation schema', () => {
  it('normalizes candidate emails and rejects duplicates', () => {
    expect(
      generateExamInvitationsSchema.parse({
        candidateEmails: [' Candidate@Example.com '],
      }),
    ).toEqual({ candidateEmails: ['candidate@example.com'] });

    expect(
      generateExamInvitationsSchema.safeParse({
        candidateEmails: ['candidate@example.com', 'CANDIDATE@example.com'],
      }).success,
    ).toBe(false);
  });
});
