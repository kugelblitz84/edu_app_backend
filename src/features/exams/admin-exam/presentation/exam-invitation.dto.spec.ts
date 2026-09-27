import { generateExamInvitationsSchema } from './exam-invitation.dto';

describe('exam invitation schema', () => {
  it('accepts user IDs and rejects duplicates', () => {
    const candidateId = '9c45926e-fab7-4873-b219-02330fba39b8';
    expect(
      generateExamInvitationsSchema.parse({
        candidateUserIds: [candidateId],
      }),
    ).toEqual({ candidateUserIds: [candidateId] });

    expect(
      generateExamInvitationsSchema.safeParse({
        candidateUserIds: [candidateId, candidateId],
      }).success,
    ).toBe(false);
  });
});
