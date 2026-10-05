import z from 'zod';

export const registerInstitutionRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Institution name is required.')
      .max(100, 'Institution name must be at most 100 characters.'),
    logo_url: z
      .url('Logo URL must be a valid URL.')
      .endsWith('.png', 'Logo URL must be a valid PNG image URL.')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description must be at most 500 characters.')
      .optional(),
  })
  .strict();

export type RegisterInstitutionRequestDto = z.infer<
  typeof registerInstitutionRequestSchema
>;
