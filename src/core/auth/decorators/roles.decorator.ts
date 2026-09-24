import { SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '../../../features/auth/register/domain/entities/registered-user.entity';

export const ROLES_KEY = 'roles';
export const Role = (...roles: PlatformRole[]) =>
  SetMetadata(ROLES_KEY, roles);

export const Roles = Role;
