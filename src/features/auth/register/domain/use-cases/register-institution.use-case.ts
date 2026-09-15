import type { RegisterInstitutionRepository } from '../contracts/register-institution.repository';
import type { RegisteredInstitution } from '../entities/registered-institution.entity';

export interface RegisterInstitutionInput {
  name: string;
  institution_code: string;
  logo_url?: string;
  description?: string;
}

export class RegisterInstitutionUseCase {
  constructor(private readonly repository: RegisterInstitutionRepository) {}

  execute(
    input: RegisterInstitutionInput,
    createdByUserId: string,
  ): Promise<RegisteredInstitution> {
    const name = input.name.trim();

    return this.repository.createInstitution({
      name,
      slug: this.toSlug(name),
      institutionCode: input.institution_code.trim().toUpperCase(),
      logoUrl: input.logo_url,
      description: input.description?.trim() || undefined,
      status: 'PENDING_APPROVAL',
      createdByUserId,
    });
  }

  private toSlug(name: string): string {
    return name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
