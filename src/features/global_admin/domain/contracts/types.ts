export type ReviewVerdict = 'APPROVED' | 'REJECTED';

export interface InstitutionReview {
  id: string;
  name: string;
  logoUrl: string | null;
  createdByUserId: string;
  createdAt: Date;
  status:
    | 'PENDING_APPROVAL'
    | 'ACTIVE'
    | 'REJECTED'
    | 'SUSPENDED'
    | 'DELETED'
    | 'ARCHIVED';
  institutionCode: string | null;
  reviewVerdict: ReviewVerdict | null;
  respondedByUserId: string | null;
  respondedAt: Date | null;
  rejectReason: string | null;
  reviewNotes: string | null;
}

export interface ReviewPageOptions {
  page: number;
  limit: number;
  search?: string;
  sortBy: 'name' | 'createdAt' | 'respondedAt';
  sortOrder: 'asc' | 'desc';
}

export interface ReviewPage {
  list: InstitutionReview[];
  total: number;
}

export interface ReviewDecision {
  verdict: ReviewVerdict;
  respondedByUserId: string;
  respondedAt: Date;
  institutionCode?: string;
  rejectReason?: string;
  notes?: string;
}
