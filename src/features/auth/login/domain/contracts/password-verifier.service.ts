export abstract class PasswordVerifier {
  abstract verify(password: string, passwordHash: string): Promise<boolean>;
}
