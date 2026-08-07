import {DomainError} from '../../../../../core/errors/domain.error';

// export class PassResetValidationError extends DomainError {
//     constructor(public readonly violations: string[]) { // use the violations for logging or debugging purposes
//         super('Pass reset request is invalid.');
//     }
// }

export type PassResetErrorType = 'mail_not_found' | 'pin_not_matched' | 'pin_expired' | 'unknown';
export class PassResetErrors extends DomainError {
    private constructor(
        public readonly errorType: PassResetErrorType,
        message: string,
    ) {
        super(message);
    }

    static mailNotFound(): PassResetErrors {
        return new PassResetErrors(
            'mail_not_found',
            'No account found with the provided email address.',
        );
    }

    static pinNotMatched(): PassResetErrors {
        return new PassResetErrors(
            'pin_not_matched',
            'The provided PIN does not match our records.',
        );
    }

    static pinExpired(): PassResetErrors {
        return new PassResetErrors(
            'pin_expired',
            'The provided PIN has expired. Please request a new one.',
        );
    }

    static unknown(): PassResetErrors {
        return new PassResetErrors(
            'unknown',
            'An unknown error occurred during the password reset process.',
        );
    }
}
