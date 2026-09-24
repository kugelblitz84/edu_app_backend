import type { ExamQuestion } from '../../../../mongoose/models/exam-data.model';

export type ExamStatus =
  'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

export interface InstitutionExam {
  id: string;
  institutionId: string;
  name: string;
  description: string | null;
  examDate: Date | null;
  durationMinutes: number | null;
  status: ExamStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDraftExamInput {
  institutionId: string;
  name: string;
  description?: string;
  createdByUserId: string;
}

export interface ScheduleExamInput {
  examDate: Date;
  durationMinutes: number;
  questions: ExamQuestion[];
}
