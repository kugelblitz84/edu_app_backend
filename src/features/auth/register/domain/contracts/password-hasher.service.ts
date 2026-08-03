export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
}
