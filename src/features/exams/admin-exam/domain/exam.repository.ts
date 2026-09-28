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
  abstract createExamDataVersion(
    examId: string,
    version: number,
    questions: ScheduleExamInput['questions'],
  ): Promise<void>;
  abstract scheduleDraft(
    id: string,
    scope: ExamScope,
    userId: string,
    input: Omit<ScheduleExamInput, 'questions'> & { contentVersion: number },
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
  abstract findActiveCandidatesByIds(
    userIds: string[],
  ): Promise<ActiveCandidate[]>;
}
