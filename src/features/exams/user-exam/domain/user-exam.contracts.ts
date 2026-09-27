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

export abstract class UserExamRepository {
  abstract findAvailableById(id: string): Promise<AccessibleExam | null>;
}
