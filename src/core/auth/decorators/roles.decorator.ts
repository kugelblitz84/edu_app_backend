import { SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '../domain/identity.types';

export const ROLES_KEY = 'roles';
export const PlatformUserRole = (...roles: PlatformRole[]) => SetMetadata(ROLES_KEY, roles);

export const Roles = PlatformUserRole;
