import { z } from 'zod';

export const createPaymentSchema = z.object({
  transactionId: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  amount: z.number().positive().finite(),
  currency: z.string().trim().length(3).default('BDT'),
  productName: z.string().trim().min(1).max(255),
  productCategory: z.string().trim().min(1).max(100),
  customer: z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(100),
    address: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(50),
    postalCode: z.string().trim().min(1).max(20),
    country: z.string().trim().min(1).max(50),
    phone: z.string().trim().min(1).max(20),
  }).strict(),
  metadata: z.record(z.string(), z.string()).optional(),
}).strict();

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
