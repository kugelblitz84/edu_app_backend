import type { ExamContentReader } from '../contracts/exam-content.reader';
import type { LiveExamRepository } from '../contracts/live-exam.repository';
import { GradeAttemptUseCase } from './grade-attempt.usecase';

describe(GradeAttemptUseCase.name, () => {
  it('grades exact option sets and applies the snapshotted pass threshold', async () => {
    const persistGrade = jest
      .fn()
      .mockImplementation(
        (_attemptId: string, _answers: unknown, summary: unknown) =>
          Promise.resolve({ summary }),
      );
    const repository = {
      findForGrading: jest.fn().mockResolvedValue({
        id: 'attempt-id',
        userId: 'user-id',
        examId: 'exam-id',
        examScope: 'PUBLIC',
        examName: 'Final',
        institutionId: null,
        contentVersion: 2,
        passPercentage: 50,
        attemptNumber: 1,
        status: 'SUBMITTED',
        startedAt: new Date(),
        expiresAt: new Date(),
        submittedAt: new Date(),
        answers: [
          {
            questionId: 'q1',
            answer: { selectedOptionIds: ['b', 'a'] },
            revision: 2,
          },
          {
            questionId: 'q2',
            answer: { selectedOptionIds: ['wrong'] },
            revision: 1,
          },
        ],
      }),
      persistGrade,
    } as unknown as LiveExamRepository;
    const content = {
      getAnswerKey: jest.fn().mockResolvedValue([
        {
          questionId: 'q1',
          question: 'One',
          options: [],
          correctOptionIds: ['a', 'b'],
          markValue: 2,
        },
        {
          questionId: 'q2',
          question: 'Two',
          options: [],
          correctOptionIds: ['right'],
          markValue: 1,
        },
        {
          questionId: 'q3',
          question: 'Three',
          options: [],
          correctOptionIds: ['yes'],
          markValue: 1,
        },
      ]),
    } as unknown as ExamContentReader;

    await new GradeAttemptUseCase(repository, content).execute('attempt-id');

    expect(persistGrade).toHaveBeenCalledWith(
      'attempt-id',
      [
        { questionId: 'q1', isCorrect: true, awardedMarks: 2 },
        { questionId: 'q2', isCorrect: false, awardedMarks: 0 },
      ],
      {
        score: 2,
        maximumScore: 4,
        percentage: 50,
        passed: true,
        correctAnswers: 1,
        incorrectAnswers: 1,
        unanswered: 1,
      },
    );
  });
});
