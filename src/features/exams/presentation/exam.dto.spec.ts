import { updateExamContentSchema, updateExamMetadataSchema } from './exam.dto';

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
