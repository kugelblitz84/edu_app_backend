export interface PassResetEntity {
    id: string;
    userId: string;
    userEmail: string;
    codeDigest: string;
    expiresAt: string;
    failedAttempts: number;
    verfiedAt: string;
    consumedAt: string;
    createdAt: string;
}

export interface ForgotPassEntity {
    id: string;
    email: string;
    codeDigest: string;
    expiredAt: string;
    verfiedAt: string;
    consumedAt: string;
    createdAt: string;
}