import { HttpException, HttpStatus } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import { RateLimitService } from './rate-limit.service';

describe(RateLimitService.name, () => {
  const queryRaw =
    jest.fn<(query: unknown) => Promise<Array<{ count: number }>>>();
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  const rateLimits = new RateLimitService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('allows requests inside a shared database-backed window', async () => {
    queryRaw.mockResolvedValue([{ count: 3 }]);

    await expect(
      rateLimits.enforce('login', 'person@example.com', 5, 60_000),
    ).resolves.toBeUndefined();

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns HTTP 429 after the shared limit is exceeded', async () => {
    queryRaw.mockResolvedValue([{ count: 6 }]);

    const result = rateLimits.enforce('login', 'client', 5, 60_000);
    await expect(result).rejects.toMatchObject<HttpException>({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });
});
