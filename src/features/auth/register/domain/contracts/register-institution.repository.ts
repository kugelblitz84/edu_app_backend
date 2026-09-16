import type { RegisteredInstitution } from '../entities/registered-institution.entity';

export interface CreateInstitutionRecord {
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  status: 'PENDING_APPROVAL';
  createdByUserId: string;
}

export abstract class RegisterInstitutionRepository {
  abstract createInstitution(
    institution: CreateInstitutionRecord,
  ): Promise<RegisteredInstitution>;
}
