import type {
  InstitutionReview,
  ReviewDecision,
  ReviewPage,
  ReviewPageOptions,
} from './types';

export abstract class GlobalAdminRepository {
  abstract findPending(options: ReviewPageOptions): Promise<ReviewPage>;
  abstract findRespondedBy(
    userId: string,
    options: ReviewPageOptions,
  ): Promise<ReviewPage>;
  abstract findById(id: string): Promise<InstitutionReview | null>;
  abstract respondToPending(
    id: string,
    decision: ReviewDecision,
  ): Promise<InstitutionReview | null>;
}
