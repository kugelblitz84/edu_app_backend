import type { RegisteredUser } from '../../domain/entities/registered-user.entity';

export interface RegisterUserResponseDto {
  id: string;
  email: string;
  username: string;
  platformRole: string;
  status: string;
  createdAt: string;
}

export function toRegisterUserResponseDto(
  user: RegisteredUser,
): RegisterUserResponseDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    platformRole: user.platformRole,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}
