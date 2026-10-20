import {
  dummyPaymentSchema,
  enrollRequestSchema,
  listInstitutionsQuerySchema,
  reviewEnrollmentSchema,
} from './institutions.dto';

describe('institutions.dto schemas', () => {
  describe('enrollRequestSchema', () => {
    it('accepts empty object', () => {
      const parsed = enrollRequestSchema.safeParse({});
      expect(parsed.success).toBe(true);
    });

    it('accepts simulatePayment boolean', () => {
      const parsed = enrollRequestSchema.safeParse({ simulatePayment: true });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.simulatePayment).toBe(true);
      }
    });

    it('rejects unknown fields in strict mode', () => {
      const parsed = enrollRequestSchema.safeParse({ unknownField: 123 });
      expect(parsed.success).toBe(false);
    });
  });

  describe('dummyPaymentSchema', () => {
    it('accepts empty object or valid payment fields', () => {
      const parsed = dummyPaymentSchema.safeParse({
        paymentMethod: 'BKASH',
        transactionReference: 'TRX-9999',
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects non-string values', () => {
      const parsed = dummyPaymentSchema.safeParse({
        paymentMethod: 12345,
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('reviewEnrollmentSchema', () => {
    it('accepts APPROVED status', () => {
      const parsed = reviewEnrollmentSchema.safeParse({
        status: 'APPROVED',
      });
      expect(parsed.success).toBe(true);
    });

    it('accepts REJECTED status with note', () => {
      const parsed = reviewEnrollmentSchema.safeParse({
        status: 'REJECTED',
        note: 'Not eligible at this time',
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid status', () => {
      const parsed = reviewEnrollmentSchema.safeParse({
        status: 'PENDING',
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('listInstitutionsQuerySchema', () => {
    it('applies defaults for pagination', () => {
      const parsed = listInstitutionsQuerySchema.safeParse({});
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBe(1);
        expect(parsed.data.limit).toBe(20);
      }
    });

    it('coerces string numbers for query params', () => {
      const parsed = listInstitutionsQuerySchema.safeParse({
        page: '2',
        limit: '15',
        search: 'Engineering',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBe(2);
        expect(parsed.data.limit).toBe(15);
        expect(parsed.data.search).toBe('Engineering');
      }
    });
  });
});

