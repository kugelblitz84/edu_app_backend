import type { RegisterInstitutionRepository } from '../contracts/register-institution.repository';
import type { RegisteredInstitution } from '../entities/registered-institution.entity';

export interface RegisterInstitutionInput {
  name: string;
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
    const slug = this.toSlug(name);
    const logoUrl = input.logo_url?.trim() || undefined;
    const description = input.description?.trim() || undefined;
    const status = 'PENDING_APPROVAL';
    
    return this.repository.createInstitution({
      name,
      slug,
      logoUrl,
      description,
      status,
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
