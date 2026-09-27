import { z } from 'zod';

export const generateExamInvitationsSchema = z
  .object({
    candidateEmails: z
      .array(z.string().trim().toLowerCase().pipe(z.email()))
      .min(1)
      .max(1000),
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.candidateEmails).size !== input.candidateEmails.length) {
      context.addIssue({
        code: 'custom',
        path: ['candidateEmails'],
        message: 'Candidate emails must be unique.',
      });
    }
  });

export type GenerateExamInvitationsRequestDto = z.infer<
  typeof generateExamInvitationsSchema
>;

export interface GeneratedExamInvitationDto {
  email: string;
  token: string;
  expiresAt: Date;
}

export interface GenerateExamInvitationsResponseDto {
  examId: string;
  invitations: GeneratedExamInvitationDto[];
}
