import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  GlobalAdminRepository,
  type ReviewDecision,
  type ReviewPage,
  type ReviewPageOptions,
  type ReviewVerdict,
  type InstitutionReview,
} from './contracts/repositories';
import {
  InstitutionCodeConflictError,
  InstitutionCodeGenerator,
} from './contracts/services';

export interface RespondToInstitutionInput {
  verdict: ReviewVerdict;
  rejectReason?: string;
  notes?: string;
}

@Injectable()
export class GlobalAdminUseCases {
  constructor(
    private readonly repository: GlobalAdminRepository,
    private readonly codeGenerator: InstitutionCodeGenerator,
  ) {}

  getPending(options: ReviewPageOptions): Promise<ReviewPage> {
    return this.repository.findPending(options);
  }

  getRespondedBy(
    userId: string,
    options: ReviewPageOptions,
  ): Promise<ReviewPage> {
    return this.repository.findRespondedBy(userId, options);
  }

  async respond(
    id: string,
    userId: string,
    input: RespondToInstitutionInput,
  ): Promise<InstitutionReview> {
    const respondedAt = new Date();
    const decision: ReviewDecision = {
      verdict: input.verdict,
      respondedByUserId: userId,
      respondedAt,
      rejectReason: input.rejectReason,
      notes: input.notes,
    };

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const reviewed = await this.repository.respondToPending(id, {
          ...decision,
          institutionCode:
            input.verdict === 'APPROVED'
              ? this.codeGenerator.generate()
              : undefined,
        });

        if (reviewed) return reviewed;

        const existing = await this.repository.findById(id);
        if (!existing)
          throw new NotFoundException('Institution application not found.');
        throw new ConflictException(
          'Institution application is not pending approval.',
        );
      } catch (error) {
        if (
          error instanceof InstitutionCodeConflictError &&
          input.verdict === 'APPROVED'
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new InternalServerErrorException(
      'Unable to allocate a unique institution code.',
    );
  }
}
