import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema(
  {
    contentId: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
  })