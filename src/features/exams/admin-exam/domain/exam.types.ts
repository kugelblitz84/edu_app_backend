export type ExamStatus =
  'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

export type ExamScope = 'PUBLIC' | 'INSTITUTIONAL';
export type ExamAccessMode = 'OPEN' | 'INVITE_ONLY';

interface ExamBase {
  id: string;
  name: string;
  description: string | null;
  startsAt: Date | null;
  closesAt: Date | null;
  durationMinutes: number | null;
  maxAttempts: number;
  passPercentage: number | null;
  contentVersion: number;
  status: ExamStatus;
  accessMode: ExamAccessMode;
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
  accessMode: ExamAccessMode;
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
  startsAt: Date;
  closesAt: Date;
  durationMinutes: number;
  maxAttempts: number;
  passPercentage?: number | null;
  questions: AuthoringExamQuestion[];
}

export interface AuthoringExamQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  markValue: number;
}

export interface UpdateExamMetadataInput {
  name?: string;
  description?: string | null;
  startsAt?: Date | null;
  closesAt?: Date | null;
  durationMinutes?: number | null;
  maxAttempts?: number;
  passPercentage?: number | null;
  accessMode?: ExamAccessMode;
}

export interface ActiveCandidate {
  id: string;
  email: string;
}

export interface UpdateExamContentInput {
  questions?: AuthoringExamQuestion[];
}
