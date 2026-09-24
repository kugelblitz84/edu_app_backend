import type {
  CreateDraftExamInput,
  InstitutionExam,
  ScheduleExamInput,
  UpdateExamContentInput,
  UpdateExamMetadataInput,
} from './exam.types';
import type { ExamData } from '../../../../mongoose/models/exam-data.model';

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
  abstract updateMetadata(
    id: string,
    input: UpdateExamMetadataInput,
  ): Promise<InstitutionExam | null>;
  abstract updateContent(
    examId: string,
    input: UpdateExamContentInput,
  ): Promise<ExamData | null>;
}
