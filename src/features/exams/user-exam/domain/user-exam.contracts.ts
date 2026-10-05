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

export interface InstitutionExamPage {
  list: AccessibleExam[];
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
