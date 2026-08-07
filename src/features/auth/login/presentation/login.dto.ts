import { z } from 'zod';
import type { LoggedInUser } from '../domain/entities/logged-in-user.entity';

export const loginRequestSchema = z
  .object({
    username: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim() : value),
      z
        .string({ error: 'Username is required.' })
        .min(1, 'Username is required.')
        .max(30, 'Username is invalid.'),
    ),
    password: z
      .string({ error: 'Password is required.' })
      .min(1, 'Password is required.')
      .max(128, 'Password is invalid.'),
  })
  .strict();

export type LoginRequestDto = z.infer<typeof loginRequestSchema>;

export type LoginResponseDto = LoggedInUser;

export function toLoginResponseDto(user: LoggedInUser): LoginResponseDto {
  return user;
}
