import { Injectable } from '@nestjs/common';
import { ExamContentReader } from '../contracts/exam-content.reader';
import { LiveExamRepository } from '../contracts/live-exam.repository';
import type { AttemptResult } from '../types/live-exam.types';

@Injectable()
export class GradeAttemptUseCase {
  constructor(
    private readonly repository: LiveExamRepository,
    private readonly content: ExamContentReader,
  ) {}

  async execute(attemptId: string): Promise<AttemptResult | null> {
    const attempt = await this.repository.findForGrading(attemptId);
    if (
      !attempt ||
      !['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'].includes(attempt.status)
    )
      return null;
    const questions = await this.content.getAnswerKey(
      attempt.examId,
      attempt.contentVersion,
    );
    if (!questions) return null;
    const submitted = new Map(
      attempt.answers.map((answer) => [answer.questionId, answer]),
    );
    let score = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unanswered = 0;
    const updates = questions.flatMap((question) => {
      const answer = submitted.get(question.questionId);
      if (!answer) {
        unanswered += 1;
        return [];
      }
      const selected = [...answer.answer.selectedOptionIds].sort();
      const expected = [...question.correctOptionIds].sort();
      const isCorrect =
        selected.length === expected.length &&
        selected.every((value, index) => value === expected[index]);
      if (isCorrect) {
        correctAnswers += 1;
        score += question.markValue;
      } else {
        incorrectAnswers += 1;
      }
      return [
        {
          questionId: question.questionId,
          isCorrect,
          awardedMarks: isCorrect ? question.markValue : 0,
        },
      ];
    });
    const maximumScore = questions.reduce(
      (total, question) => total + question.markValue,
      0,
    );
    const percentage = maximumScore === 0 ? 0 : (score / maximumScore) * 100;
    const passed =
      attempt.passPercentage === null
        ? null
        : percentage >= attempt.passPercentage;
    return this.repository.persistGrade(attemptId, updates, {
      score,
      maximumScore,
      percentage,
      passed,
      correctAnswers,
      incorrectAnswers,
      unanswered,
    });
  }
}
