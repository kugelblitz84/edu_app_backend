import type {
  ExamAccessMode,
  ExamScope,
} from '../../admin-exam/domain/exam.types';

export interface AccessibleExam {
  id: string;
  name: string;
  scope: ExamScope;
  accessMode: ExamAccessMode;
  institutionId: string | null;
  startsAt: Date | null;
  closesAt: Date | null;
  durationMinutes: number | null;
  maxAttempts: number;
  passPercentage: number | null;
  contentVersion: number;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
}

export abstract class ExamAccessRepository {
  abstract findExamForAccess(examId: string): Promise<AccessibleExam | null>;
  abstract hasActiveEnrollment(
    institutionId: string,
    userId: string,
  ): Promise<boolean>;
}
