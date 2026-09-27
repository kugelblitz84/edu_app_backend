import type { ExamQuestion } from '../../../../mongoose/models/exam-data.model';

export type ExamStatus =
  'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

export type ExamScope = 'PUBLIC' | 'INSTITUTIONAL';

interface ExamBase {
  id: string;
  name: string;
  description: string | null;
  examDate: Date | null;
  durationMinutes: number | null;
  status: ExamStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicExam extends ExamBase {
  scope: 'PUBLIC';
  institutionId: null;
}

export interface InstitutionalExam extends ExamBase {
  scope: 'INSTITUTIONAL';
  institutionId: string;
}

export type Exam = PublicExam | InstitutionalExam;

interface CreateDraftExamBase {
  name: string;
  description?: string;
  createdByUserId: string;
}

export interface CreatePublicDraftExamInput extends CreateDraftExamBase {
  scope: 'PUBLIC';
}

export interface CreateInstitutionalDraftExamInput extends CreateDraftExamBase {
  scope: 'INSTITUTIONAL';
  institutionId: string;
}

export type CreateDraftExamInput =
  CreatePublicDraftExamInput | CreateInstitutionalDraftExamInput;

export interface ScheduleExamInput {
  examDate: Date;
  durationMinutes: number;
  questions: ExamQuestion[];
}

export interface UpdateExamMetadataInput {
  name?: string;
  description?: string | null;
  examDate?: Date | null;
  durationMinutes?: number | null;
}

export interface UpdateExamContentInput {
  questions?: ExamQuestion[];
}
