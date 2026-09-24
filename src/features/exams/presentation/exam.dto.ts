import { z } from 'zod';

export const createExamSchema = z
  .object({
    institutionId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

const questionSchema = z
  .object({
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).min(2),
    correctAnswer: z.string().trim().min(1),
    markValue: z.number().positive().default(1),
  })
  .strict()
  .superRefine((question, context) => {
    if (!question.options.includes(question.correctAnswer)) {
      context.addIssue({
        code: 'custom',
        path: ['correctAnswer'],
        message: 'The correct answer must be one of the question options.',
      });
    }
  });

export const scheduleExamSchema = z
  .object({
    examDate: z.iso.datetime({ offset: true }),
    durationMinutes: z.number().int().positive(),
    questions: z.array(questionSchema).min(1),
  })
  .strict();

export type CreateExamRequestDto = z.infer<typeof createExamSchema>;
export type ScheduleExamRequestDto = z.infer<typeof scheduleExamSchema>;

export interface ExamResponseDto {
  id: string;
  institutionId: string;
  name: string;
  description: string | null;
  examDate: Date | null;
  durationMinutes: number | null;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}
