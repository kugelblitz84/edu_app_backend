import mongoose from 'mongoose';

export const questionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    question: {
      type: String,
      required: true,
    },
    options: {
      type: [
        new mongoose.Schema(
          {
            optionId: { type: String, required: true },
            text: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      required: true,
    },
    correctOptionIds: { type: [String], required: true },
    markValue: {
      type: Number,
      required: false,
      default: 1,
    },
  },
  { _id: false },
);

export const examDataSchema = new mongoose.Schema(
  {
    examId: {
      type: String,
      required: true,
    },
    version: { type: Number, required: true },
    totalQuestions: {
      type: Number,
      required: true,
    },

    questions: {
      type: [questionSchema],
      required: true,
    },
  },
  { timestamps: true },
);

examDataSchema.index({ examId: 1, version: 1 }, { unique: true });

export interface ExamOption {
  optionId: string;
  text: string;
}

export interface ExamQuestion {
  questionId: string;
  question: string;
  options: ExamOption[];
  correctOptionIds: string[];
  markValue: number;
}

export interface ExamData {
  examId: string;
  version: number;
  totalQuestions: number;
  questions: ExamQuestion[];
}
