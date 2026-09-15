import type {
  CreateInstitutionRecord,
  RegisterInstitutionRepository,
} from '../contracts/register-institution.repository';
import type { RegisteredInstitution } from '../entities/registered-institution.entity';
import { RegisterInstitutionUseCase } from './register-institution.use-case';

class FakeRegisterInstitutionRepository implements RegisterInstitutionRepository {
  createdInstitution?: CreateInstitutionRecord;

  createInstitution(
    institution: CreateInstitutionRecord,
  ): Promise<RegisteredInstitution> {
    this.createdInstitution = institution;

    return Promise.resolve({
      id: '3bb216fa-38a6-4a3c-bb7d-c2ee47e26140',
      ...institution,
      logoUrl: institution.logoUrl ?? null,
      description: institution.description ?? null,
      createdAt: new Date('2026-09-15T00:00:00.000Z'),
      updatedAt: new Date('2026-09-15T00:00:00.000Z'),
      archivedAt: null,
    });
  }
}

describe(RegisterInstitutionUseCase.name, () => {
  it('creates an institution application in pending approval state', async () => {
    const repository = new FakeRegisterInstitutionRepository();
    const useCase = new RegisterInstitutionUseCase(repository);

    const institution = await useCase.execute(
      {
        name: '  Dhaka Learning Academy  ',
        institution_code: '  dla-01  ',
        description: '  A learning institution.  ',
      },
      '13c66d9e-42e8-4188-9c10-e2a8d8405587',
    );

    expect(repository.createdInstitution).toEqual({
      name: 'Dhaka Learning Academy',
      slug: 'dhaka-learning-academy',
      institutionCode: 'DLA-01',
      logoUrl: undefined,
      description: 'A learning institution.',
      status: 'PENDING_APPROVAL',
      createdByUserId: '13c66d9e-42e8-4188-9c10-e2a8d8405587',
    });
    expect(institution.status).toBe('PENDING_APPROVAL');
  });
});
