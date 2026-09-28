import { z } from 'zod';

export const authorizeExamAccessSchema = z
  .object({
    invitationToken: z.string().min(1).max(4096).optional(),
  })
  .strict();

export type AuthorizeExamAccessRequestDto = z.infer<
  typeof authorizeExamAccessSchema
>;

export const PaginatedExamQuerySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).max(50).default(5),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  })
  .strict();

export type PaginatedExamQueryDto = z.infer<typeof PaginatedExamQuerySchema>;

export const publicExamQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['SCHEDULED', 'RUNNING', 'COMPLETED']).optional(),
    prefix: z.string().trim().min(1).max(200).optional(),
    orderBy: z.enum(['name', 'startsAt', 'createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export type PublicExamQueryDto = z.infer<typeof publicExamQuerySchema>;

export interface PublicExamResponseDto {
  id: string;
  name: string;
  description: string | null;
  startsAt: Date | null;
  closesAt: Date | null;
  durationMinutes: number | null;
  status: 'SCHEDULED' | 'RUNNING' | 'COMPLETED';
  accessMode: 'OPEN' | 'INVITE_ONLY';
  createdAt: Date;
  updatedAt: Date;
}

export interface InstitutionExamResponseDto {
  id: string;
  scope: 'INSTITUTIONAL';
  accessMode: 'OPEN' | 'INVITE_ONLY';
  status: 'SCHEDULED' | 'RUNNING';
}

export interface PaginatedExamResponseDto<TExam> {
  list: TExam[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuthorizeExamAccessResponseDto {
  authorized: true;
  examId: string;
  scope: 'PUBLIC' | 'INSTITUTIONAL';
  accessMode: 'OPEN' | 'INVITE_ONLY';
}
