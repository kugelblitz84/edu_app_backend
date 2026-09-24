import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
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
    }
})
const examDataSchema = new mongoose.Schema(
    {
        examId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        totalQuestions: {
            type: Number,
            required: true,
        },

        questions: {
            type: [questionSchema],
            required: true,
        }
    }
);