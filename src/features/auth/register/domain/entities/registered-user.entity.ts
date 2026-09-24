export type PlatformRole = 'PLATFORM_USER' | 'GLOBAL_ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';

export interface RegisteredUser {
  id: string;
  email: string;
  username: string;
  platformRole: PlatformRole;
  status: UserStatus;
  createdAt: Date;
}
