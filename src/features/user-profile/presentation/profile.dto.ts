import { z } from 'zod';

const USERNAME_MESSAGE =
  'Username must be 3-30 characters and contain only letters, numbers, and underscores.';

export const profileUsernameSchema = z
  .string({ error: USERNAME_MESSAGE })
  .trim()
  .min(3, USERNAME_MESSAGE)
  .max(30, USERNAME_MESSAGE)
  .regex(/^[a-zA-Z0-9_]+$/, USERNAME_MESSAGE);

export const updateProfileSchema = z
  .object({
    username: profileUsernameSchema.optional(),
    fullName: z.string().trim().min(1).max(160).optional(),
    avatarUrl: z
      .union([z.string().trim().url().max(2048), z.null()])
      .optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one profile field is required.',
  });

export type UpdateProfileRequestDto = z.infer<typeof updateProfileSchema>;

export interface PublicProfileResponseDto {
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface OwnProfileResponseDto extends PublicProfileResponseDto {
  id: string;
  email: string;
}
