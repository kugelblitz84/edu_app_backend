import { z } from 'zod';

export const passResetRequestSchema = z.object({
    email: z.preprocess(
        (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
        z
            .string({ error: 'A valid email address is required.' })
            .trim()
            .toLowerCase()
            .pipe(z.email({ error: 'A valid email address is required.' }))
            //.email('A valid email address is required.')
    )
});

