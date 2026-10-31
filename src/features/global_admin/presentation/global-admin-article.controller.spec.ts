import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import type { ArticleService } from '../../articles/domain/article.service';
import { GlobalAdminArticleController } from './global-admin-article.controller';

describe('GlobalAdminArticleController', () => {
  let controller: GlobalAdminArticleController;
  let service: jest.Mocked<Partial<ArticleService>>;

  const adminUser: AuthenticatedUser = {
    userId: 'admin-uuid-1234',
    roles: ['GLOBAL_ADMIN'],
    sessionId: 'session-admin',
  };

  beforeEach(() => {
    service = {
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

    controller = new GlobalAdminArticleController(service as ArticleService);
  });

  it('delegates getPending to articleService.getPendingArticles', async () => {
    const query = { page: 1, limit: 10 };
    await controller.getPending(query);
    expect(service.getPendingArticles).toHaveBeenCalledWith(query);
  });

  it('delegates getRespondedByMe to articleService.getRespondedByMe with admin userId', async () => {
    const query = { page: 1, limit: 10 };
    await controller.getRespondedByMe(query, adminUser);
    expect(service.getRespondedByMe).toHaveBeenCalledWith(adminUser.userId, query);
  });

  it('delegates getDetail to articleService.getArticleForAdminReview', async () => {
    await controller.getDetail('art-123');
    expect(service.getArticleForAdminReview).toHaveBeenCalledWith('art-123');
  });

  it('delegates respond to articleService.reviewArticle', async () => {
    const body = { status: 'APPROVED' as const, reviewNotes: 'LGTM' };
    await controller.respond('art-123', body, adminUser);
    expect(service.reviewArticle).toHaveBeenCalledWith(adminUser, 'art-123', body);
  });
});
