export interface CreateInstitutionRecord {
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  status: 'PENDING_APPROVAL';
  createdByUserId: string;
}

export interface CreateUserRecord {
  email: string;
  username: string;
  passwordHash: string;
  fullName: string;
}

export interface RegisterUserInput {
  email?: unknown;
  username?: unknown;
  password?: unknown;
}

export interface NormalizedRegisterUser {
  email: string;
  username: string;
  password: string;
}
