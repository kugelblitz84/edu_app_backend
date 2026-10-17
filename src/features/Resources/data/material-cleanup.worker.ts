import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { StorageProvider } from '../../../core/storage/domain/contracts';
import { StorageError } from '../../../core/storage/domain/storage.errors';
import {
  MATERIAL_CONFIG,
  type MaterialConfig,
} from '../application/material.config';
import { mapFile } from './material.repository';

@Injectable()
export class MaterialCleanupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaterialCleanupWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    @Inject(MATERIAL_CONFIG) private readonly config: MaterialConfig,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick().catch(() =>
        this.logger.warn(
          'Material cleanup tick failed; durable jobs will retry.',
        ),
      );
    }, this.config.cleanupPollMs);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // Expiry sweep and claiming use the same lock as activation/deletion.
      const claimToken = randomUUID();
      const jobs = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(74121017)`;
        const expired = await tx.resourceFile.findMany({
          where: {
            state: 'PENDING',
            cleanupState: 'NONE',
            expiresAt: { lte: new Date() },
            attached: false,
          },
          take: this.config.cleanupBatch,
          orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        });
        for (const file of expired) {
          await tx.resourceFile.update({
            where: { id: file.id },
            data: { state: 'REJECTED', cleanupState: 'QUEUED' },
          });
          await tx.resourceCleanupJob.upsert({
            where: { fileId: file.id },
            create: {
              fileId: file.id,
              nextAttemptAt: new Date(
                file.expiresAt.getTime() + this.config.cleanupGraceMs,
              ),
            },
            update: {},
          });
        }
        return tx.$queryRaw<
          { file_id: string; attempts: number; last_error: string | null }[]
        >(Prisma.sql`
          WITH candidates AS (
            SELECT j.file_id FROM resource_cleanup_jobs j JOIN resource_files f ON f.id = j.file_id
            WHERE j.completed_at IS NULL AND j.next_attempt_at <= now()
              AND (j.claimed_at IS NULL OR j.claimed_at < now() - interval '10 minutes')
              AND NOT f.attached AND f.cleanup_state = 'QUEUED'
              AND f.expires_at + ${this.config.cleanupGraceMs} * interval '1 millisecond' <= now()
            ORDER BY j.next_attempt_at, j.file_id FOR UPDATE OF j SKIP LOCKED LIMIT ${this.config.cleanupBatch}
          ) UPDATE resource_cleanup_jobs j SET claimed_at = now(), claim_token = ${claimToken}::uuid, attempts = j.attempts + 1
            FROM candidates c WHERE j.file_id = c.file_id RETURNING j.file_id, j.attempts, j.last_error
        `);
      });
      for (const job of jobs) {
        const row = await this.prisma.resourceFile.findFirst({
          where: {
            id: job.file_id,
            attached: false,
            cleanupState: 'QUEUED',
            cleanupJob: { claimToken },
          },
        });
        if (!row) continue;
        const file = mapFile(row);
        try {
          try {
            await this.storage.delete(file.verifiedReference ?? file.reference);
          } catch (error) {
            if (!(error instanceof StorageError) || error.code !== 'NOT_FOUND')
              throw error;
          }
          const done = job.last_error === 'VERIFY_LATE_UPLOAD';
          await this.prisma.$transaction(async (tx) => {
            const claimed = await tx.resourceCleanupJob.updateMany({
              where: { fileId: file.id, claimToken },
              data: {
                claimedAt: null,
                claimToken: null,
                completedAt: done ? new Date() : null,
                nextAttemptAt: new Date(
                  Date.now() + this.config.cleanupGraceMs,
                ),
                lastError: done ? null : 'VERIFY_LATE_UPLOAD',
              },
            });
            if (claimed.count && done)
              await tx.resourceFile.updateMany({
                where: { id: file.id, attached: false, cleanupState: 'QUEUED' },
                data: { cleanupState: 'DONE' },
              });
          });
        } catch {
          // Never persist provider error bodies: they may contain signed locators or credentials.
          const delay = Math.min(
            86400000,
            30000 * 2 ** Math.min(job.attempts, 11),
          );
          await this.prisma.resourceCleanupJob.updateMany({
            where: { fileId: file.id, claimToken },
            data: {
              claimedAt: null,
              claimToken: null,
              nextAttemptAt: new Date(Date.now() + delay),
              lastError: 'STORAGE_UNAVAILABLE',
            },
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
