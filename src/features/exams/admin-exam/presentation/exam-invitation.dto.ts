import { z } from 'zod';

export const generateExamInvitationsSchema = z
  .object({
    candidateUserIds: z.array(z.string().uuid()).min(1).max(1000),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      new Set(input.candidateUserIds).size !== input.candidateUserIds.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['candidateUserIds'],
        message: 'Candidate user IDs must be unique.',
      });
    }
  });

export type GenerateExamInvitationsRequestDto = z.infer<
  typeof generateExamInvitationsSchema
>;

export interface GeneratedExamInvitationDto {
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
}

export interface GenerateExamInvitationsResponseDto {
  examId: string;
  invitations: GeneratedExamInvitationDto[];
}
