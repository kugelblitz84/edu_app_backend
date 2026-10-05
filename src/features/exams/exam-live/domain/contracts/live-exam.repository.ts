import type { AccessibleExam } from '../../../shared/domain/exam-access.repository';
import type {
  AttemptRecord,
  AttemptResult,
  AttemptWithAnswers,
} from '../types/live-exam.types';

export interface AttemptMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface GradeAnswerUpdate {
  questionId: string;
  isCorrect: boolean;
  awardedMarks: number;
}

export interface GradeSummary {
  score: number;
  maximumScore: number;
  percentage: number;
  passed: boolean | null;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
}

export abstract class LiveExamRepository {
  abstract startOrResume(
    exam: AccessibleExam,
    userId: string,
    metadata: AttemptMetadata,
  ): Promise<AttemptRecord | null>;
  abstract startOrResumePractice(
    exam: AccessibleExam,
    userId: string,
    metadata: AttemptMetadata,
  ): Promise<AttemptRecord | null>;
  abstract findOwned(
    attemptId: string,
    userId: string,
  ): Promise<AttemptWithAnswers | null>;
  abstract findForGrading(
    attemptId: string,
  ): Promise<AttemptWithAnswers | null>;
  abstract saveAnswer(input: {
    attemptId: string;
    userId: string;
    questionId: string;
    selectedOptionIds: string[];
    revision: number;
    now: Date;
  }): Promise<{ revision: number; saved: boolean } | null>;
  abstract finalize(
    attemptId: string,
    userId: string,
    now: Date,
  ): Promise<AttemptRecord | null>;
  abstract claimExpired(now: Date, limit: number): Promise<AttemptRecord[]>;
  abstract findPendingGrading(limit: number): Promise<AttemptRecord[]>;
  abstract persistGrade(
    attemptId: string,
    answers: GradeAnswerUpdate[],
    summary: GradeSummary,
  ): Promise<AttemptResult | null>;
  abstract findResult(
    attemptId: string,
    userId: string,
  ): Promise<AttemptResult | null>;
}
