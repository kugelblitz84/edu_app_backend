import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import type { ScryptSecretHasher } from '../../../core/security/scrypt-secret-hasher.service';
import type { ScryptSecretVerifier } from '../../../core/security/scrypt-secret-verifier.service';
import {
  ArticleAuthorRepository,
  ArticleContentRepository,
  ArticleRepository,
  type ArticleMetadataRecord,
} from './article.repository-contract';
import type { ArticleContentData } from './article.types';
import { ArticleUseCases } from './article.usecases';

describe('ArticleUseCases', () => {
  let service: ArticleUseCases;
  let repository: jest.Mocked<ArticleRepository>;
  let contentRepository: jest.Mocked<ArticleContentRepository>;
  let hasher: jest.Mocked<ScryptSecretHasher>;
  let verifier: jest.Mocked<ScryptSecretVerifier>;
  let authors: jest.Mocked<ArticleAuthorRepository>;

  const author: AuthenticatedUser = {
    userId: '11111111-1111-1111-1111-111111111111',
    platformRole: 'PLATFORM_USER',
    sessionId: 'session-1',
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  };

  const admin: AuthenticatedUser = {
    userId: '99999999-9999-9999-9999-999999999999',
    platformRole: 'GLOBAL_ADMIN',
    sessionId: 'session-admin',
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  };

  const reader: AuthenticatedUser = {
    userId: '22222222-2222-2222-2222-222222222222',
    platformRole: 'PLATFORM_USER',
    sessionId: 'session-2',
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  };

  const mockArticle: ArticleMetadataRecord = {
    id: 'art-1234-uuid',
    contentId: 'art-1234-uuid',
    title: 'Mastering System Design',
    description: 'A deep dive into distributed systems',
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
    contentVersion: 1,
    unlockedUserIds: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    publishedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  const mockArticleContent: ArticleContentData = {
    articleId: mockArticle.id,
    version: 1,
    theme: {
      baseFont: 'Inter',
      headingFont: 'Playfair Display',
      containerWidth: 'normal',
    },
    sections: [
      {
        id: 'sec-1',
        layout: 'SINGLE_COLUMN',
        blocks: [
          {
            id: 'b-1',
            type: 'PARAGRAPH',
            html: '<p>Full content of the article detailing microservices, caching, and partitioning.</p>',
          },
        ],
      },
    ],
    plainTextSummary:
      'Full content of the article detailing microservices, caching, and partitioning.',
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByContentId: jest.fn(),
      updateById: jest.fn(),
      updateByContentId: jest.fn(),
      findPublished: jest.fn(),
      findByAuthor: jest.fn(),
      findPending: jest.fn(),
      findRespondedBy: jest.fn(),
      hasUserUnlocked: jest.fn(),
      grantUnlock: jest.fn(),
      addUnlockUser: jest.fn(),
    } as unknown as jest.Mocked<ArticleRepository>;

    contentRepository = {
      saveContent: jest.fn(),
      findByArticleId: jest.fn(),
      deleteByArticleId: jest.fn(),
    } as unknown as jest.Mocked<ArticleContentRepository>;

    hasher = {
      hash: jest.fn().mockResolvedValue('hashed_pin_123456'),
    } as unknown as jest.Mocked<ScryptSecretHasher>;

    verifier = {
      verify: jest.fn(),
    } as unknown as jest.Mocked<ScryptSecretVerifier>;

    authors = {
      findById: jest.fn().mockResolvedValue({
        username: 'author_dev',
        fullName: 'Author Dev',
      }),
    } as unknown as jest.Mocked<ArticleAuthorRepository>;

    service = new ArticleUseCases(
      repository,
      contentRepository,
      authors,
      hasher,
      verifier,
    );
  });

  describe('createDraft', () => {
    it('creates a draft purchase article in postgres and saves content in mongodb', async () => {
      repository.create.mockResolvedValue(mockArticle);
      contentRepository.saveContent.mockResolvedValue(mockArticleContent);

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
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Mastering System Design',
          accessPolicy: 'PURCHASE',
          pinHash: 'hashed_pin_123456',
          authorId: author.userId,
        }),
      );
      expect(contentRepository.saveContent).toHaveBeenCalledWith(
        mockArticle.id,
        expect.objectContaining({
          articleId: mockArticle.id,
          version: 1,
        }),
      );
      expect(result.id).toBe(mockArticle.id);
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

  describe('updateDraft', () => {
    it('updates draft metadata and content version in postgres and saves to mongodb', async () => {
      const draftArticle: ArticleMetadataRecord = {
        ...mockArticle,
        status: 'DRAFT',
      };
      repository.findById.mockResolvedValue(draftArticle);
      repository.updateById.mockResolvedValue({
        ...draftArticle,
        title: 'Updated Title',
        contentVersion: 2,
      });
      contentRepository.findByArticleId.mockResolvedValue(mockArticleContent);
      contentRepository.saveContent.mockResolvedValue({
        ...mockArticleContent,
        version: 2,
      });

      const result = await service.updateDraft(author, draftArticle.id, {
        title: 'Updated Title',
        content: 'New content for article that is updated',
      });

      expect(repository.updateById).toHaveBeenCalledWith(
        draftArticle.id,
        expect.objectContaining({
          title: 'Updated Title',
          contentVersion: 2,
        }),
      );
      expect(contentRepository.saveContent).toHaveBeenCalledWith(
        draftArticle.id,
        expect.objectContaining({
          version: 2,
        }),
      );
      expect(result.title).toBe('Updated Title');
    });

    it('rejects update if actor is not the author', async () => {
      repository.findById.mockResolvedValue(mockArticle);

      await expect(
        service.updateDraft(reader, mockArticle.id, { title: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects update if article is already published', async () => {
      repository.findById.mockResolvedValue(mockArticle); // status is PUBLISHED

      await expect(
        service.updateDraft(author, mockArticle.id, { title: 'Cannot edit' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('submitForReview', () => {
    it('submits a draft article when content is valid', async () => {
      const draftArticle: ArticleMetadataRecord = {
        ...mockArticle,
        status: 'DRAFT',
      };
      repository.findById.mockResolvedValue(draftArticle);
      contentRepository.findByArticleId.mockResolvedValue(mockArticleContent);
      repository.updateById.mockResolvedValue({
        ...draftArticle,
        status: 'PENDING_REVIEW',
      });

      const result = await service.submitForReview(author, draftArticle.id);

      expect(repository.updateById).toHaveBeenCalledWith(draftArticle.id, {
        status: 'PENDING_REVIEW',
      });
      expect(result.status).toBe('PENDING_REVIEW');
    });

    it('rejects submission if content is less than 10 characters', async () => {
      const draftArticle: ArticleMetadataRecord = {
        ...mockArticle,
        status: 'DRAFT',
      };
      repository.findById.mockResolvedValue(draftArticle);
      contentRepository.findByArticleId.mockResolvedValue({
        ...mockArticleContent,
        plainTextSummary: 'short',
        sections: [],
      });

      await expect(
        service.submitForReview(author, draftArticle.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getArticleDetail', () => {
    it('returns preview snippet and locked state for reader on un-unlocked paid article', async () => {
      repository.findById.mockResolvedValue(mockArticle);
      repository.hasUserUnlocked.mockResolvedValue(false);
      contentRepository.findByArticleId.mockResolvedValue(mockArticleContent);

      const result = await service.getArticleDetail(
        mockArticle.id,
        reader.userId,
      );

      expect(result.access.canAccess).toBe(false);
      expect(result.access.reason).toBe('PIN_REQUIRED');
      expect(result.content).toBeUndefined();
      expect(result.contentPayload).toBeUndefined();
      expect(result.previewSnippet).toBe(mockArticle.description);
    });

    it('returns full content payload for the article author even if paid', async () => {
      repository.findById.mockResolvedValue(mockArticle);
      contentRepository.findByArticleId.mockResolvedValue(mockArticleContent);

      const result = await service.getArticleDetail(
        mockArticle.id,
        author.userId,
      );

      expect(result.access.canAccess).toBe(true);
      expect(result.access.reason).toBe('OWNER');
      expect(result.contentPayload).toEqual(mockArticleContent);
    });

    it('returns full content payload if reader has unlocked the article', async () => {
      repository.findById.mockResolvedValue(mockArticle);
      repository.hasUserUnlocked.mockResolvedValue(true);
      contentRepository.findByArticleId.mockResolvedValue(mockArticleContent);

      const result = await service.getArticleDetail(
        mockArticle.id,
        reader.userId,
      );

      expect(result.access.canAccess).toBe(true);
      expect(result.access.reason).toBe('UNLOCKED');
      expect(result.contentPayload).toEqual(mockArticleContent);
    });

    it('returns full content payload for free article to any visitor', async () => {
      repository.findById.mockResolvedValue({
        ...mockArticle,
        accessPolicy: 'FREE',
      });
      contentRepository.findByArticleId.mockResolvedValue(mockArticleContent);

      const result = await service.getArticleDetail(mockArticle.id, undefined);

      expect(result.access.canAccess).toBe(true);
      expect(result.access.reason).toBe('FREE');
      expect(result.contentPayload).toEqual(mockArticleContent);
    });
  });

  describe('unlockArticle', () => {
    it('successfully unlocks paid article when correct PIN is provided', async () => {
      repository.findById.mockResolvedValue(mockArticle);
      repository.hasUserUnlocked.mockResolvedValue(false);
      verifier.verify.mockResolvedValue(true);
      repository.grantUnlock.mockResolvedValue(true);

      const result = await service.unlockArticle(
        reader,
        mockArticle.id,
        '123456',
      );

      expect(result.success).toBe(true);
      expect(verifier.verify).toHaveBeenCalledWith(
        '123456',
        mockArticle.pinHash,
      );
      expect(repository.grantUnlock).toHaveBeenCalledWith(
        mockArticle.id,
        reader.userId,
        'PIN',
      );
    });

    it('rejects incorrect PIN with ForbiddenException', async () => {
      repository.findById.mockResolvedValue(mockArticle);
      repository.hasUserUnlocked.mockResolvedValue(false);
      verifier.verify.mockResolvedValue(false);

      await expect(
        service.unlockArticle(reader, mockArticle.id, '999999'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reviewArticle (Super Admin)', () => {
    it('approves a pending article and marks it published', async () => {
      const pendingArticle: ArticleMetadataRecord = {
        ...mockArticle,
        status: 'PENDING_REVIEW',
      };
      repository.findById.mockResolvedValue(pendingArticle);
      repository.updateById.mockImplementation(async (_id, updates) => ({
        ...pendingArticle,
        ...updates,
      }));

      const result = await service.reviewArticle(admin, pendingArticle.id, {
        status: 'APPROVED',
        reviewNotes: 'Looks solid and accurate.',
      });

      expect(result.status).toBe('PUBLISHED');
      expect(repository.updateById).toHaveBeenCalledWith(
        pendingArticle.id,
        expect.objectContaining({
          status: 'PUBLISHED',
          reviewedByUserId: admin.userId,
        }),
      );
    });

    it('rejects a pending article with required rejection reason', async () => {
      const pendingArticle: ArticleMetadataRecord = {
        ...mockArticle,
        status: 'PENDING_REVIEW',
      };
      repository.findById.mockResolvedValue(pendingArticle);
      repository.updateById.mockImplementation(async (_id, updates) => ({
        ...pendingArticle,
        ...updates,
      }));

      const result = await service.reviewArticle(admin, pendingArticle.id, {
        status: 'REJECTED',
        rejectReason: 'Needs references for citations.',
      });

      expect(result.status).toBe('REJECTED');
      expect(repository.updateById).toHaveBeenCalledWith(
        pendingArticle.id,
        expect.objectContaining({
          status: 'REJECTED',
          rejectReason: 'Needs references for citations.',
        }),
      );
    });

    it('rejects review attempt on non-pending article with ConflictException', async () => {
      repository.findById.mockResolvedValue(mockArticle); // status is PUBLISHED

      await expect(
        service.reviewArticle(admin, mockArticle.id, {
          status: 'APPROVED',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
