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

export interface LoginResponseDto {
  user: LoggedInUser['user'];
  accessToken: string;
  csrfToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export function toLoginResponseDto(
  user: LoggedInUser,
  csrfToken: string,
): LoginResponseDto {
  return {
    user: user.user,
    accessToken: user.accessToken,
    csrfToken,
    tokenType: user.tokenType,
    expiresIn: user.expiresIn,
  };
}
