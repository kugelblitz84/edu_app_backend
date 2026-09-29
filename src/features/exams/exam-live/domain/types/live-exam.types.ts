import type { ExamAttemptStatus } from '@prisma/client';

export interface CandidateQuestion {
  questionId: string;
  question: string;
  options: { optionId: string; text: string }[];
  markValue: number;
}

export interface AnswerKeyQuestion extends CandidateQuestion {
  correctOptionIds: string[];
}

export interface AttemptRecord {
  id: string;
  userId: string;
  examId: string;
  examScope: 'PUBLIC' | 'INSTITUTIONAL';
  examName: string;
  institutionId: string | null;
  contentVersion: number;
  passPercentage: number | null;
  isPractice: boolean;
  attemptNumber: number;
  status: ExamAttemptStatus;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
}

export interface SavedAnswer {
  questionId: string;
  answer: { selectedOptionIds: string[] };
  revision: number;
}

export interface AttemptWithAnswers extends AttemptRecord {
  answers: SavedAnswer[];
}

export interface AttemptResult {
  attemptId: string;
  status: ExamAttemptStatus;
  score: number;
  maximumScore: number;
  percentage: number;
  passed: boolean | null;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  gradedAt: Date;
}
