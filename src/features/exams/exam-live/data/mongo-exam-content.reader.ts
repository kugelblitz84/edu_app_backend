import { Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import {
  examDataSchema,
  type ExamData,
} from '../../../../../mongoose/models/exam-data.model';
import { MongooseService } from '../../../../core/database/mongoose.service';
import { ExamContentReader } from '../domain/contracts/exam-content.reader';
import type {
  AnswerKeyQuestion,
  CandidateQuestion,
} from '../domain/types/live-exam.types';

@Injectable()
export class MongoExamContentReader implements ExamContentReader {
  constructor(private readonly mongoose: MongooseService) {}

  async getCandidateQuestions(
    examId: string,
    version: number,
  ): Promise<CandidateQuestion[] | null> {
    const content = await this.read(examId, version);
    if (!content) return null;
    return content.questions.map((question) => ({
      questionId: question.questionId,
      question: question.question,
      options: question.options,
      markValue: question.markValue,
    }));
  }

  async getAnswerKey(
    examId: string,
    version: number,
  ): Promise<AnswerKeyQuestion[] | null> {
    const content = await this.read(examId, version);
    return content?.questions ?? null;
  }

  async hasQuestion(
    examId: string,
    version: number,
    questionId: string,
  ): Promise<boolean> {
    return Boolean(
      await this.model.exists({
        examId,
        version,
        'questions.questionId': questionId,
      }),
    );
  }

  private read(examId: string, version: number): Promise<ExamData | null> {
    return this.model.findOne({ examId, version }).lean<ExamData>().exec();
  }

  private get model(): Model<ExamData> {
    return (
      (this.mongoose.connection.models.ExamData as
        Model<ExamData> | undefined) ??
      this.mongoose.connection.model<ExamData>('ExamData', examDataSchema)
    );
  }
}
