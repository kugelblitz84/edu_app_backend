import type {
	PlatformRole,
	UserStatus,
} from '../../features/auth/register/domain/entities/registered-user.entity';

export interface AccessTokenSubject {
	userId: string;
	username: string;
	email: string;
	platformRole: PlatformRole;
	status: UserStatus;
	emailVerified: boolean;
}

export interface GeneratedTokenPair {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresIn: number;
}

export interface VerifiedAccessToken {
	userId: string;
	platformRole: PlatformRole;
	issuedAt: Date;
}

export interface JwtPayload {
	[claim: string]: boolean | number | string;
}

export interface AccessTokenPayload {
	sub?: unknown;
	role?: unknown;
	iat?: unknown;
	exp?: unknown;
	iss?: unknown;
	aud?: unknown;
	tokenType?: unknown;
}

export interface VerifiedTokenPayload {
	sub: string;
	role?: unknown;
	iat: number;
	exp: number;
	iss: string;
	aud: string;
	tokenType: 'access' | 'refresh';
}

export interface RefreshTokenPayload extends VerifiedTokenPayload {
	username?: unknown;
	email?: unknown;
	role?: unknown;
	status?: unknown;
	emailVerified?: unknown;
}
