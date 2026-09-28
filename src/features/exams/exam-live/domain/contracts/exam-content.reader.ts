import type {
  AnswerKeyQuestion,
  CandidateQuestion,
} from '../types/live-exam.types';

export abstract class ExamContentReader {
  abstract getCandidateQuestions(
    examId: string,
    version: number,
  ): Promise<CandidateQuestion[] | null>;
  abstract getAnswerKey(
    examId: string,
    version: number,
  ): Promise<AnswerKeyQuestion[] | null>;
  abstract hasQuestion(
    examId: string,
    version: number,
    questionId: string,
  ): Promise<boolean>;
}
