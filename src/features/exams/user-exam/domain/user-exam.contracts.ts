import type { AuthenticatedUser } from '../../../../core/auth/auth.types';
import type { Prisma } from '@prisma/client';
import type {
  ExamAccessMode,
  ExamScope,
  ExamStatus,
} from '../../admin-exam/domain/exam.types';

export interface AccessibleExam {
  id: string;
  scope: ExamScope;
  accessMode: ExamAccessMode;
  status: ExamStatus;
}

export interface InstitutionExamQuery {
  id?: string;
  page: number;
  limit: number;
}

export interface InstitutionExamListItem extends AccessibleExam {
  startsAt: Date | null;
  closesAt: Date | null;
  durationMinutes: number | null;
}

export interface InstitutionExamPage {
  list: InstitutionExamListItem[];
  total: number;
}

export type PublicExamStatus = Extract<
  ExamStatus,
  'SCHEDULED' | 'RUNNING' | 'COMPLETED'
>;

export interface PublicExamQuery {
  page: number;
  limit: number;
  status?: PublicExamStatus;
  prefix?: string;
  orderBy: 'name' | 'startsAt' | 'createdAt';
  order: 'asc' | 'desc';
}

export interface PublicExamListItem {
  id: string;
  name: string;
  description: string | null;
  startsAt: Date | null;
  closesAt: Date | null;
  durationMinutes: number | null;
  status: PublicExamStatus;
  accessMode: ExamAccessMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicExamPage {
  list: PublicExamListItem[];
  total: number;
}

export abstract class UserExamRepository {
  abstract findHistory(
    userId: string,
    viewer: AuthenticatedUser,
    query: ExamHistoryQuery,
  ): Promise<{ list: ExamAttemptHistoryItem[]; total: number }>;
  abstract findAttempt(
    userId: string,
    attemptId: string,
    viewer: AuthenticatedUser,
  ): Promise<ExamAttemptHistoryItem | null>;

  abstract findAvailableById(id: string): Promise<AccessibleExam | null>;
  abstract hasActiveEnrollment(
    institutionId: string,
    userId: string,
  ): Promise<boolean>;
  abstract findInstitutionExams(
    institutionId: string,
    query: InstitutionExamQuery,
  ): Promise<InstitutionExamPage>;
  abstract findPublicExams(query: PublicExamQuery): Promise<PublicExamPage>;
}

export interface ExamHistoryQuery {
  page: number;
  limit: number;
  examId?: string;
  scope?: ExamScope;
}
export interface ExamAttemptHistoryItem {
  id: string;
  examId: string;
  examScope: ExamScope;
  examName: string;
  institutionId: string | null;
  contentVersion: number;
  isPractice: boolean;
  attemptNumber: number;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  totalScore: number | null;
  result?: {
    maximumScore: number;
    percentage: number;
    passed: boolean | null;
    correctAnswers: number;
    incorrectAnswers: number;
    unanswered: number;
    gradedAt: Date;
  } | null;
  answers?: {
    questionId: string;
    answerData: Prisma.JsonValue;
    isCorrect: boolean | null;
    awardedMarks: number | null;
    answeredAt: Date;
  }[];
}
