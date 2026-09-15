export abstract class PassResetMailerService {
  abstract sendResetLink(email: string, token: string): Promise<void>;
  abstract sendPasswordChangedNotice(email: string): Promise<void>;
}
