import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { InstitutionCodeGenerator } from '../domain/contracts/services';

@Injectable()
export class RandomInstitutionCodeGenerator implements InstitutionCodeGenerator {
  generate(): string {
    return `INS-${randomBytes(8).toString('hex').toUpperCase()}`;
  }
}
