import { SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '../domain/identity.types';

export const ROLES_KEY = 'roles';
export const Role = (...roles: PlatformRole[]) => SetMetadata(ROLES_KEY, roles);

export const Roles = Role;
