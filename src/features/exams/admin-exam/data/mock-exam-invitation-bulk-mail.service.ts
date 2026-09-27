import { Injectable } from '@nestjs/common';
import {
  ExamInvitationBulkMailService,
  type ExamInvitationMail,
} from '../domain/exam-invitation.services';

@Injectable()
export class MockExamInvitationBulkMailService implements ExamInvitationBulkMailService {
  readonly sentBatches: ExamInvitationMail[][] = [];

  sendBulk(invitations: ExamInvitationMail[]): Promise<void> {
    this.sentBatches.push(invitations.map((invitation) => ({ ...invitation })));
    return Promise.resolve();
  }
}
