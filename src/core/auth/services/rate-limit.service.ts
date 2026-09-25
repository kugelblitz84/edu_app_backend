import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface RateLimitRow {
  count: number;
}

@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async enforce(
    scope: string,
    identity: string,
    limit: number,
    windowMilliseconds: number,
    message = 'Too many requests. Please try again later.',
  ): Promise<void> {
    const key = createHash('sha256')
      .update(`${scope}:${identity}`, 'utf8')
      .digest('hex');
    const now = new Date();
    const resetsAt = new Date(now.getTime() + windowMilliseconds);
    const [bucket] = await this.prisma.$queryRaw<RateLimitRow[]>(Prisma.sql`
      WITH cleanup AS (
        DELETE FROM rate_limit_buckets
        WHERE resets_at < ${new Date(now.getTime() - 24 * 60 * 60_000)}
      )
      INSERT INTO rate_limit_buckets (key, count, resets_at)
      VALUES (${key}, 1, ${resetsAt})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limit_buckets.resets_at <= ${now} THEN 1
          ELSE rate_limit_buckets.count + 1
        END,
        resets_at = CASE
          WHEN rate_limit_buckets.resets_at <= ${now} THEN ${resetsAt}
          ELSE rate_limit_buckets.resets_at
        END
      RETURNING count
    `);

    if (!bucket || bucket.count > limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
