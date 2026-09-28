import { z } from 'zod';

const createExamBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1000).optional(),
  accessMode: z.enum(['OPEN', 'INVITE_ONLY']).default('OPEN'),
});

export const createExamSchema = z.discriminatedUnion('scope', [
  createExamBaseSchema
    .extend({
      scope: z.literal('PUBLIC'),
    })
    .strict(),
  createExamBaseSchema
    .extend({
      scope: z.literal('INSTITUTIONAL'),
      institutionId: z.string().uuid(),
    })
    .strict(),
]);

export const examQuestionSchema = z
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
    startsAt: z.iso.datetime({ offset: true }),
    closesAt: z.iso.datetime({ offset: true }),
    durationMinutes: z.number().int().positive(),
    maxAttempts: z.number().int().min(1).default(1),
    passPercentage: z.number().min(0).max(100).nullable().optional(),
    questions: z.array(examQuestionSchema).min(1).max(100),
  })
  .strict()
  .refine((input) => new Date(input.startsAt) < new Date(input.closesAt), {
    path: ['closesAt'],
    message: 'closesAt must be later than startsAt.',
  });

export type CreateExamRequestDto = z.infer<typeof createExamSchema>;
export type ScheduleExamRequestDto = z.infer<typeof scheduleExamSchema>;

export const updateExamMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(1000).nullable().optional(),
    startsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    closesAt: z.iso.datetime({ offset: true }).nullable().optional(),
    durationMinutes: z
      .number()
      .int()
      .positive()
      .max(1440 * 7)
      .nullable()
      .optional(),
    accessMode: z.enum(['OPEN', 'INVITE_ONLY']).optional(),
    maxAttempts: z.number().int().min(1).optional(),
    passPercentage: z.number().min(0).max(100).nullable().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one metadata field is required.',
  });

export const updateExamContentSchema = z
  .object({
    questions: z.array(examQuestionSchema).min(1).max(100).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one content field is required.',
  });

export type UpdateExamMetadataRequestDto = z.infer<
  typeof updateExamMetadataSchema
>;
export type UpdateExamContentRequestDto = z.infer<
  typeof updateExamContentSchema
>;

export interface ExamResponseDto {
  id: string;
  scope: 'PUBLIC' | 'INSTITUTIONAL';
  institutionId: string | null;
  name: string;
  description: string | null;
  startsAt: Date | null;
  closesAt: Date | null;
  durationMinutes: number | null;
  maxAttempts: number;
  passPercentage: number | null;
  contentVersion: number;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  accessMode: 'OPEN' | 'INVITE_ONLY';
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetExamsResponseDto {
  id: string;
  scope: 'PUBLIC' | 'INSTITUTIONAL';
  accessMode: 'OPEN' | 'INVITE_ONLY';
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
}

export interface ExamContentResponseDto {
  examId: string;
  version: number;
  totalQuestions: number;
  questions: {
    questionId: string;
    question: string;
    options: { optionId: string; text: string }[];
    correctOptionIds: string[];
    markValue: number;
  }[];
}
