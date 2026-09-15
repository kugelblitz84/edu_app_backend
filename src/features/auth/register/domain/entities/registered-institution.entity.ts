export interface RegisteredInstitution {
  id: string;
  name: string;
  slug: string;
  institutionCode: string;
  logoUrl: string | null;
  description: string | null;
  status: 'SUSPENDED' | 'ACTIVE' | 'PENDING_APPROVAL' | 'DELETED' | 'ARCHIVED';
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
