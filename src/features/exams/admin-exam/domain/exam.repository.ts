import type {
  CreateDraftExamInput,
  Exam,
  ExamScope,
  ScheduleExamInput,
  UpdateExamContentInput,
  UpdateExamMetadataInput,
  ActiveCandidate,
} from './exam.types';
import type { ExamData } from '../../../../../mongoose/models/exam-data.model';

export abstract class ExamRepository {
  abstract createDraft(input: CreateDraftExamInput): Promise<Exam | null>;
  abstract findAccessibleById(id: string, userId: string): Promise<Exam | null>;
  abstract upsertExamData(
    examId: string,
    questions: ScheduleExamInput['questions'],
  ): Promise<void>;
  abstract scheduleDraft(
    id: string,
    scope: ExamScope,
    userId: string,
    input: Pick<ScheduleExamInput, 'examDate' | 'durationMinutes'>,
  ): Promise<Exam | null>;
  abstract updateMetadata(
    id: string,
    scope: ExamScope,
    userId: string,
    input: UpdateExamMetadataInput,
  ): Promise<Exam | null>;
  abstract updateContent(
    examId: string,
    input: UpdateExamContentInput,
  ): Promise<ExamData | null>;
  abstract findActiveCandidatesByEmails(
    emails: string[],
  ): Promise<ActiveCandidate[]>;
}
