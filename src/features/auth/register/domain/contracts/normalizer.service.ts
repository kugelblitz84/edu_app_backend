
export interface RegisterUserInput {
  email?: unknown;
  username?: unknown;
  password?: unknown;
}



export abstract class normalizer {
    abstract normalizeAndValidate(input: RegisterUserInput): {
    email: string;
    username: string;
    password: string;
  };
}