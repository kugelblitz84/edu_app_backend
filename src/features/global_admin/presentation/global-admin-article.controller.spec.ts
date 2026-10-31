import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import type { ArticleUseCases } from '../../articles/domain/article.usecases';
import { GlobalAdminArticleController } from './global-admin-article.controller';

describe('GlobalAdminArticleController', () => {
  let controller: GlobalAdminArticleController;
  let useCases: jest.Mocked<Partial<ArticleUseCases>>;

  const adminUser: AuthenticatedUser = {
    userId: 'admin-uuid-1234',
    roles: ['GLOBAL_ADMIN'],
    sessionId: 'session-admin',
  };

  beforeEach(() => {
    useCases = {
      getPendingArticles: jest.fn().mockResolvedValue({
        list: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
      getRespondedByMe: jest.fn().mockResolvedValue({
        list: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
      getArticleForAdminReview: jest.fn().mockResolvedValue({
        contentId: 'art-123',
        title: 'Pending Article',
        content: 'Article content',
        accessPolicy: 'FREE',
        status: 'PENDING_REVIEW',
        tags: [],
        authorUsername: 'author',
        createdAt: new Date(),
        access: { canAccess: true, reason: 'SUPER_ADMIN' },
      }),
      reviewArticle: jest.fn().mockResolvedValue({
        contentId: 'art-123',
        title: 'Pending Article',
        accessPolicy: 'FREE',
        status: 'PUBLISHED',
        tags: [],
        authorUsername: 'author',
        createdAt: new Date(),
      }),
    };

    controller = new GlobalAdminArticleController(useCases as ArticleUseCases);
  });

  it('delegates getPending to articleService.getPendingArticles', async () => {
    const query = { page: 1, limit: 10 };
    await controller.getPending(query);
    expect(useCases.getPendingArticles).toHaveBeenCalledWith(query);
  });

  it('delegates getRespondedByMe to articleService.getRespondedByMe with admin userId', async () => {
    const query = { page: 1, limit: 10 };
    await controller.getRespondedByMe(query, adminUser);
    expect(useCases.getRespondedByMe).toHaveBeenCalledWith(
      adminUser.userId,
      query,
    );
  });

  it('delegates getDetail to articleService.getArticleForAdminReview', async () => {
    await controller.getDetail('art-123');
    expect(useCases.getArticleForAdminReview).toHaveBeenCalledWith('art-123');
  });

  it('delegates respond to articleService.reviewArticle', async () => {
    const body = { status: 'APPROVED' as const, reviewNotes: 'LGTM' };
    await controller.respond('art-123', body, adminUser);
    expect(useCases.reviewArticle).toHaveBeenCalledWith(
      adminUser,
      'art-123',
      body,
    );
  });
});
