import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { ArticleUseCases } from './article.usecases';
import type {
  ArticleRepository,
  ArticleAuthorRepository,
  ArticleRecord,
} from './article.repository';
import type { MongoArticleRepository } from '../data/mongo-article.repository';
import type { ScryptSecretHasher } from '../../../core/security/scrypt-secret-hasher.service';
import type { ScryptSecretVerifier } from '../../../core/security/scrypt-secret-verifier.service';

describe('ArticleUseCases', () => {
  let service: ArticleUseCases;
  let repository: jest.Mocked<Partial<MongoArticleRepository>>;
  let hasher: jest.Mocked<Partial<ScryptSecretHasher>>;
  let verifier: jest.Mocked<Partial<ScryptSecretVerifier>>;
  let authors: jest.Mocked<Partial<ArticleAuthorRepository>>;

  const author: AuthenticatedUser = {
    userId: '11111111-1111-1111-1111-111111111111',
    roles: ['USER'],
    sessionId: 'session-1',
  };

  const admin: AuthenticatedUser = {
    userId: '99999999-9999-9999-9999-999999999999',
    roles: ['GLOBAL_ADMIN'],
    sessionId: 'session-admin',
  };

  const reader: AuthenticatedUser = {
    userId: '22222222-2222-2222-2222-222222222222',
    roles: ['USER'],
    sessionId: 'session-2',
  };

  const mockArticle: ArticleRecord = {
    contentId: 'art-1234-uuid',
    title: 'Mastering System Design',
    description: 'A deep dive into distributed systems',
    content:
      'Full content of the article detailing microservices, caching, and partitioning.',
    accessPolicy: 'PURCHASE',
    priceAmountMinor: 499,
    currency: 'USD',
    pinHash: 'hashed_pin_123456',
    status: 'PUBLISHED',
    tags: ['system-design', 'backend'],
    coverImageUrl: 'https://example.com/cover.png',
    authorId: author.userId,
    authorUsername: 'author_dev',
    authorFullName: 'Author Dev',
    unlockedUserIds: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    publishedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByContentId: jest.fn(),
      updateByContentId: jest.fn(),
      findPublished: jest.fn(),
      findByAuthor: jest.fn(),
      findPending: jest.fn(),
      findRespondedBy: jest.fn(),
      addUnlockUser: jest.fn(),
    };

    hasher = {
      hash: jest.fn().mockResolvedValue('hashed_pin_123456'),
    };

    verifier = {
      verify: jest.fn(),
    };

    authors = {
      findById: jest.fn().mockResolvedValue({
        username: 'author_dev',
        fullName: 'Author Dev',
      }),
    };

    service = new ArticleUseCases(
      repository as unknown as ArticleRepository,
      authors as ArticleAuthorRepository,
      hasher as ScryptSecretHasher,
      verifier as ScryptSecretVerifier,
    );
  });

  describe('createDraft', () => {
    it('creates a draft purchase article with hashed pin', async () => {
      (repository.create as jest.Mock).mockResolvedValue(mockArticle);

      const result = await service.createDraft(author, {
        title: 'Mastering System Design',
        description: 'A deep dive into distributed systems',
        content: 'Full content of the article',
        accessPolicy: 'PURCHASE',
        priceAmountMinor: 499,
        currency: 'USD',
        pin: '123456',
        tags: ['system-design'],
      });

      expect(hasher.hash).toHaveBeenCalledWith('123456');
      expect(repository.create).toHaveBeenCalled();
      expect(result.contentId).toBe(mockArticle.contentId);
    });

    it('throws error when purchase article has no pin', async () => {
      await expect(
        service.createDraft(author, {
          title: 'Mastering System Design',
          content: 'Full content',
          accessPolicy: 'PURCHASE',
          priceAmountMinor: 499,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getArticleDetail', () => {
    it('returns preview snippet and locked state for un-unlocked reader on paid article', async () => {
      (repository.findByContentId as jest.Mock).mockResolvedValue(mockArticle);

      const result = await service.getArticleDetail(
        mockArticle.contentId,
        reader.userId,
      );

      expect(result.access.canAccess).toBe(false);
      expect(result.access.reason).toBe('PIN_REQUIRED');
      expect(result.content).toBeUndefined();
      expect(result.previewSnippet).toBe(mockArticle.description);
    });

    it('returns full content for the article author even if paid', async () => {
      (repository.findByContentId as jest.Mock).mockResolvedValue(mockArticle);

      const result = await service.getArticleDetail(
        mockArticle.contentId,
        author.userId,
      );

      expect(result.access.canAccess).toBe(true);
      expect(result.content).toBe(mockArticle.content);
    });

    it('returns full content if reader is already in unlockedUserIds', async () => {
      (repository.findByContentId as jest.Mock).mockResolvedValue({
        ...mockArticle,
        unlockedUserIds: [reader.userId],
      });

      const result = await service.getArticleDetail(
        mockArticle.contentId,
        reader.userId,
      );

      expect(result.access.canAccess).toBe(true);
      expect(result.content).toBe(mockArticle.content);
    });

    it('returns full content for free article to any visitor', async () => {
      (repository.findByContentId as jest.Mock).mockResolvedValue({
        ...mockArticle,
        accessPolicy: 'FREE',
      });

      const result = await service.getArticleDetail(
        mockArticle.contentId,
        undefined,
      );

      expect(result.access.canAccess).toBe(true);
      expect(result.access.reason).toBe('FREE');
      expect(result.content).toBe(mockArticle.content);
    });
  });

  describe('unlockArticle', () => {
    it('successfully unlocks paid article when correct PIN is provided', async () => {
      (repository.findByContentId as jest.Mock).mockResolvedValue(mockArticle);
      (verifier.verify as jest.Mock).mockResolvedValue(true);
      (repository.addUnlockUser as jest.Mock).mockResolvedValue(true);

      const result = await service.unlockArticle(
        reader,
        mockArticle.contentId,
        '123456',
      );

      expect(result.success).toBe(true);
      expect(verifier.verify).toHaveBeenCalledWith(
        '123456',
        mockArticle.pinHash,
      );
      expect(repository.addUnlockUser).toHaveBeenCalledWith(
        mockArticle.contentId,
        reader.userId,
      );
    });

    it('rejects incorrect PIN with ForbiddenException', async () => {
      (repository.findByContentId as jest.Mock).mockResolvedValue(mockArticle);
      (verifier.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.unlockArticle(reader, mockArticle.contentId, '999999'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reviewArticle (Super Admin)', () => {
    it('approves a pending article and marks it published', async () => {
      const pendingArticle: ArticleRecord = {
        ...mockArticle,
        status: 'PENDING_REVIEW',
      };
      (repository.findByContentId as jest.Mock).mockResolvedValue(
        pendingArticle,
      );
      (repository.updateByContentId as jest.Mock).mockImplementation(
        async (_id, updates) =>
          ({ ...pendingArticle, ...updates }) as ArticleRecord,
      );

      const result = await service.reviewArticle(
        admin,
        pendingArticle.contentId,
        {
          status: 'APPROVED',
          reviewNotes: 'Looks solid and accurate.',
        },
      );

      expect(result.status).toBe('PUBLISHED');
      expect(repository.updateByContentId).toHaveBeenCalledWith(
        pendingArticle.contentId,
        expect.objectContaining({
          status: 'PUBLISHED',
          reviewedByUserId: admin.userId,
        }),
      );
    });

    it('rejects a pending article with required rejection reason', async () => {
      const pendingArticle: ArticleRecord = {
        ...mockArticle,
        status: 'PENDING_REVIEW',
      };
      (repository.findByContentId as jest.Mock).mockResolvedValue(
        pendingArticle,
      );
      (repository.updateByContentId as jest.Mock).mockImplementation(
        async (_id, updates) =>
          ({ ...pendingArticle, ...updates }) as ArticleRecord,
      );

      const result = await service.reviewArticle(
        admin,
        pendingArticle.contentId,
        {
          status: 'REJECTED',
          rejectReason: 'Needs references for citations.',
        },
      );

      expect(result.status).toBe('REJECTED');
      expect(repository.updateByContentId).toHaveBeenCalledWith(
        pendingArticle.contentId,
        expect.objectContaining({
          status: 'REJECTED',
          rejectReason: 'Needs references for citations.',
        }),
      );
    });

    it('rejects review attempt on non-pending article with ConflictException', async () => {
      (repository.findByContentId as jest.Mock).mockResolvedValue(mockArticle); // status is PUBLISHED

      await expect(
        service.reviewArticle(admin, mockArticle.contentId, {
          status: 'APPROVED',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
