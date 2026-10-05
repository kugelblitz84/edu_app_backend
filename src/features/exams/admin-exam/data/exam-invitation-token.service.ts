import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { APP_CONFIG, type AppConfig } from '../../../../core/config/app-config';
import {
  ExamInvitationTokenService,
  type ExamInvitationSubject,
  type GeneratedExamInvitation,
} from '../domain/exam-invitation.services';

interface ExamInvitationPayload {
  sub?: unknown;
  examId?: unknown;
  examScope?: unknown;
  tokenType?: unknown;
  iat?: unknown;
  exp?: unknown;
}

@Injectable()
export class JwtExamInvitationTokenService implements ExamInvitationTokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async generate(
    subject: ExamInvitationSubject,
  ): Promise<GeneratedExamInvitation> {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + this.config.auth.examInvitationTokenTtlSeconds;
    const token = await new SignJWT({
      examId: subject.examId,
      examScope: subject.examScope,
      tokenType: 'exam-invitation',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(subject.userId)
      .setIssuer(this.config.auth.issuer)
      .setAudience('edu-app-exam-invitation')
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .setJti(randomUUID())
      .sign(this.signingKey());

    return { ...subject, token, expiresAt: new Date(expiresAt * 1000) };
  }

  async verify(token: string): Promise<ExamInvitationSubject> {
    if (token.length > 4096) throw new Error('Invalid exam invitation token');

    const { payload } = await jwtVerify(token, this.signingKey(), {
      algorithms: ['HS256'],
      issuer: this.config.auth.issuer,
      audience: 'edu-app-exam-invitation',
      typ: 'JWT',
    });
    const claims = payload as ExamInvitationPayload;
    const now = Math.floor(Date.now() / 1000);

    if (
      typeof claims.sub !== 'string' ||
      typeof claims.examId !== 'string' ||
      (claims.examScope !== 'PUBLIC' && claims.examScope !== 'INSTITUTIONAL') ||
      claims.tokenType !== 'exam-invitation' ||
      typeof claims.iat !== 'number' ||
      typeof claims.exp !== 'number' ||
      !Number.isSafeInteger(claims.iat) ||
      !Number.isSafeInteger(claims.exp) ||
      claims.iat > now + 60
    ) {
      throw new Error('Invalid exam invitation token');
    }

    return {
      userId: claims.sub,
      examId: claims.examId,
      examScope: claims.examScope,
    };
  }

  private signingKey(): Uint8Array {
    return new TextEncoder().encode(this.config.auth.examInvitationTokenSecret);
  }
}
