import { SetMetadata } from '@nestjs/common';

export const OPTIONAL_AUTH_KEY = 'optionalAuth';
/** Permit missing credentials; supplied credentials still undergo full validation. */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);
