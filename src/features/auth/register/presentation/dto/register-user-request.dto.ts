import { z } from 'zod';
import { passwordSchema } from '../../../password-policy';

const EMAIL_PATTERN_MESSAGE = 'A valid email address is required.';
const USERNAME_PATTERN_MESSAGE =
  'Username must be 3-30 characters and contain only letters, numbers, and underscores.';

export const registerUserRequestSchema = z
  .object({
    email: z.preprocess(
      (value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
      z
        .string({ error: EMAIL_PATTERN_MESSAGE })
        .min(1, EMAIL_PATTERN_MESSAGE)
        .max(320, EMAIL_PATTERN_MESSAGE)
        .email(EMAIL_PATTERN_MESSAGE),
    ),
    username: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim() : value),
      z
        .string({ error: USERNAME_PATTERN_MESSAGE })
        .min(3, USERNAME_PATTERN_MESSAGE)
        .max(30, USERNAME_PATTERN_MESSAGE)
        .regex(/^[a-zA-Z0-9_]+$/, USERNAME_PATTERN_MESSAGE),
    ),
    password: passwordSchema,
  })
  .strict();

export type RegisterUserRequestDto = z.infer<typeof registerUserRequestSchema>;
