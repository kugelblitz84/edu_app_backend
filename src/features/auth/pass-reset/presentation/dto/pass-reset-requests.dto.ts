import { z } from 'zod';
import { passwordSchema } from '../../../password-policy';

export const requestPassResetSchema = z
  .object({
    email: z.preprocess(
      (value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
      z
        .string({ error: 'A valid email address is required.' })
        .min(1, 'A valid email address is required.')
        .max(320, 'A valid email address is required.')
        .email('A valid email address is required.'),
    ),
  })
  .strict();

export const confirmPassResetSchema = z
  .object({
    token: z
      .string({ error: 'A valid reset token is required.' })
      .regex(/^[A-Za-z0-9_-]{43}$/, 'A valid reset token is required.'),
    newPassword: passwordSchema,
  })
  .strict();

export const authenticatedPassResetSchema = z
  .object({
    currentPassword: z
      .string({ error: 'Current password is required.' })
      .min(1, 'Current password is required.')
      .max(128, 'Current password is invalid.'),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: 'New password must differ from the current password.',
    path: ['newPassword'],
  });

export type RequestPassResetDto = z.infer<typeof requestPassResetSchema>;
export type ConfirmPassResetDto = z.infer<typeof confirmPassResetSchema>;
export type AuthenticatedPassResetDto = z.infer<
  typeof authenticatedPassResetSchema
>;
