export interface VerifiedAccessToken {
  userId: string;
  issuedAt: Date;
}

export abstract class AccessTokenVerifier {
  abstract verify(token: string): VerifiedAccessToken;
}
