import type { RegisteredInstitution } from '../entities/registered-institution.entity';
import type { CreateInstitutionRecord } from './types';

export abstract class RegisterInstitutionRepository {
  abstract createInstitution(
    institution: CreateInstitutionRecord,
  ): Promise<RegisteredInstitution>;
}
