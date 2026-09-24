import type {
  CreateDraftExamInput,
  InstitutionExam,
  ScheduleExamInput,
} from './exam.types';

export abstract class ExamRepository {
  abstract createDraft(
    input: CreateDraftExamInput,
  ): Promise<InstitutionExam | null>;
  abstract findAccessibleById(
    id: string,
    userId: string,
  ): Promise<InstitutionExam | null>;
  abstract upsertExamData(
    examId: string,
    questions: ScheduleExamInput['questions'],
  ): Promise<void>;
  abstract scheduleDraft(
    id: string,
    input: Pick<ScheduleExamInput, 'examDate' | 'durationMinutes'>,
  ): Promise<InstitutionExam | null>;
}
