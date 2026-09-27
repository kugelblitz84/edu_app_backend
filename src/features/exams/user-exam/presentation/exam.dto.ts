import { z } from 'zod';

export const authorizeExamAccessSchema = z
  .object({
    invitationToken: z.string().min(1).max(4096).optional(),
  })
  .strict();

export type AuthorizeExamAccessRequestDto = z.infer<
  typeof authorizeExamAccessSchema
>;

export interface AuthorizeExamAccessResponseDto {
  authorized: true;
  examId: string;
  scope: 'PUBLIC' | 'INSTITUTIONAL';
  accessMode: 'OPEN' | 'INVITE_ONLY';
}
