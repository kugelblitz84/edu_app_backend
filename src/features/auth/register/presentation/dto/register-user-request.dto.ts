import { z } from 'zod';

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
    password: z
      .string({ error: 'Password must be 12-128 characters long.' })
      .min(12, 'Password must be 12-128 characters long.')
      .max(128, 'Password must be 12-128 characters long.')
      .refine(
        (password) => /[a-z]/.test(password) && /[A-Z]/.test(password),
        'Password must include lowercase and uppercase letters.',
      )
      .refine(
        (password) => /[0-9]/.test(password),
        'Password must include at least one number.',
      ),
  })
  .strict();

export type RegisterUserRequestDto = z.infer<typeof registerUserRequestSchema>;
