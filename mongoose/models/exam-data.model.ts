import mongoose from 'mongoose';

export const questionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      required: true,
    },
    correctAnswer: {
      type: String,
      required: true,
    },
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
      // InstitutionExam.id is a PostgreSQL UUID, not a Mongo ObjectId.
      type: String,
      required: true,
      unique: true,
    },
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

export interface ExamQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  markValue: number;
}

export interface ExamData {
  examId: string;
  totalQuestions: number;
  questions: ExamQuestion[];
}
