import { z } from 'zod';

export const startAttemptSchema = z
  .object({ invitationToken: z.string().min(1).max(4096).optional() })
  .strict();

export const joinAttemptSchema = z
  .object({ attemptId: z.string().uuid() })
  .strict();

export const saveAnswerSchema = z
  .object({
    attemptId: z.string().uuid(),
    questionId: z.string().uuid(),
    answer: z
      .object({
        selectedOptionIds: z.array(z.string().uuid()).max(20),
      })
      .strict(),
    revision: z.number().int().min(1),
  })
  .strict();

export type StartAttemptDto = z.infer<typeof startAttemptSchema>;
export type JoinAttemptDto = z.infer<typeof joinAttemptSchema>;
export type SaveAnswerDto = z.infer<typeof saveAnswerSchema>;
