import type { RegisteredInstitution } from '../../domain/entities/registered-institution.entity';

export interface RegisterInstitutionResponseDto {
  id: string;
  name: string;
  slug: string;
  message: string;
}

export function toRegisterInstitutionResponseDto(
  institution: RegisteredInstitution,
): RegisterInstitutionResponseDto {
  return {
    id: institution.id,
    name: institution.name,
    slug: institution.slug,
    message:
      'Your application for institution registration has been received and will be reviewed by an administrator. You will be notified once the review process is complete.',
  };
}
