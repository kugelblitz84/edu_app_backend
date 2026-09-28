import {
  createExamSchema,
  scheduleExamSchema,
  updateExamContentSchema,
  updateExamMetadataSchema,
} from './exam.dto';

describe('exam creation schema', () => {
  it('defaults an exam to open access', () => {
    expect(
      createExamSchema.parse({ scope: 'PUBLIC', name: 'Open exam' }),
    ).toMatchObject({ accessMode: 'OPEN' });
  });

  it('accepts invite-only access for either exam scope', () => {
    expect(
      createExamSchema.safeParse({
        scope: 'INSTITUTIONAL',
        institutionId: 'ed52b4d1-b69a-4705-bd3f-f946170a4813',
        name: 'Private final',
        accessMode: 'INVITE_ONLY',
      }).success,
    ).toBe(true);
  });
});

describe('exam scheduling schema', () => {
  it('rejects expired and shorter-than-one-minute windows', () => {
    const base = {
      durationMinutes: 30,
      maxAttempts: 1,
      questions: [
        {
          question: '2 + 2?',
          options: ['3', '4'],
          correctAnswer: '4',
        },
      ],
    };
    expect(
      scheduleExamSchema.safeParse({
        ...base,
        startsAt: '2020-01-01T00:00:00.000Z',
        closesAt: '2020-01-01T01:00:00.000Z',
      }).success,
    ).toBe(false);

    const startsAt = new Date(Date.now() + 3_600_000);
    expect(
      scheduleExamSchema.safeParse({
        ...base,
        startsAt: startsAt.toISOString(),
        closesAt: new Date(startsAt.getTime() + 59_999).toISOString(),
      }).success,
    ).toBe(false);
  });
});

describe('exam update schemas', () => {
  it('accepts partial metadata and rejects an empty update', () => {
    expect(
      updateExamMetadataSchema.safeParse({ durationMinutes: 90 }).success,
    ).toBe(true);
    expect(updateExamMetadataSchema.safeParse({}).success).toBe(false);
  });

  it('accepts content questions and rejects an empty update', () => {
    expect(
      updateExamContentSchema.safeParse({
        questions: [
          {
            question: '2 + 2?',
            options: ['3', '4'],
            correctAnswer: '4',
          },
        ],
      }).success,
    ).toBe(true);
    expect(updateExamContentSchema.safeParse({}).success).toBe(false);
  });
});
