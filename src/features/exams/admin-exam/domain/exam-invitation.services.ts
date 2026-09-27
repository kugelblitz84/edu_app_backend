import type { ExamScope } from './exam.types';

export interface ExamInvitationSubject {
  examId: string;
  examScope: ExamScope;
  userId: string;
}

export interface GeneratedExamInvitation extends ExamInvitationSubject {
  token: string;
  expiresAt: Date;
}

export abstract class ExamInvitationTokenService {
  abstract generate(
    subject: ExamInvitationSubject,
  ): Promise<GeneratedExamInvitation>;

  abstract verify(token: string): Promise<ExamInvitationSubject>;
}

export interface ExamInvitationMail {
  userId: string;
  email: string;
  examId: string;
  token: string;
  expiresAt: Date;
}

export abstract class ExamInvitationBulkMailService {
  abstract sendBulk(invitations: ExamInvitationMail[]): Promise<void>;
}
