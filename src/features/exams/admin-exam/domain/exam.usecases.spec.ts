import { ConflictException } from '@nestjs/common';
import { ExamRepository } from './exam.repository';
import type { InstitutionalExam } from './exam.types';
import { ExamUseCases } from './exam.usecases';

const draft: InstitutionalExam = {
  id: '8dc198a1-1b0f-4fc1-914d-319917301f3e',
  scope: 'INSTITUTIONAL',
  institutionId: 'ed52b4d1-b69a-4705-bd3f-f946170a4813',
  name: 'Final',
  description: null,
  startsAt: null,
  closesAt: null,
  durationMinutes: null,
  maxAttempts: 1,
  passPercentage: null,
  contentVersion: 0,
  status: 'DRAFT',
  accessMode: 'OPEN',
  createdByUserId: '2f273fc1-674b-4763-972c-16a87eb8a616',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const request = {
  startsAt: '2026-10-01T10:00:00.000Z',
  closesAt: '2026-10-01T12:00:00.000Z',
  durationMinutes: 60,
  maxAttempts: 1,
  questions: [
    {
      question: '2 + 2?',
      options: ['3', '4'],
      correctAnswer: '4',
      markValue: 1,
    },
  ],
};

function repositoryMock() {
  const findAccessibleById = jest.fn();
  const scheduleDraft = jest.fn();
  const updateMetadata = jest.fn();
  const updateContent = jest.fn();
  const repository: jest.Mocked<ExamRepository> = {
    createDraft: jest.fn(),
    findAccessibleById,
    scheduleDraft,
    updateMetadata,
    updateContent,
    findActiveCandidatesByIds: jest.fn(),
  };
  return {
    repository,
    findAccessibleById,
    scheduleDraft,
    updateMetadata,
    updateContent,
  };
}

describe('ExamUseCases scheduling', () => {
  it('delegates content and the schedule as one repository operation', async () => {
    const { repository, findAccessibleById, scheduleDraft } = repositoryMock();
    findAccessibleById.mockResolvedValue(draft);
    scheduleDraft.mockResolvedValue({
      ...draft,
      status: 'SCHEDULED',
      startsAt: new Date(request.startsAt),
      closesAt: new Date(request.closesAt),
      durationMinutes: 60,
    });

    const result = await new ExamUseCases(repository).schedule(
      draft.id,
      draft.createdByUserId,
      request,
    );

    expect(scheduleDraft).toHaveBeenCalledWith(
      draft.id,
      draft.scope,
      draft.createdByUserId,
      {
        ...request,
        startsAt: new Date(request.startsAt),
        closesAt: new Date(request.closesAt),
        contentVersion: 1,
      },
    );
    expect(result.status).toBe('SCHEDULED');
  });

  it('does not write Mongo when the exam is no longer DRAFT', async () => {
    const { repository, findAccessibleById, scheduleDraft } = repositoryMock();
    findAccessibleById.mockResolvedValue({
      ...draft,
      status: 'SCHEDULED',
    });

    await expect(
      new ExamUseCases(repository).schedule(
        draft.id,
        draft.createdByUserId,
        request,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(scheduleDraft).not.toHaveBeenCalled();
  });

  it('can retry the same request after PostgreSQL fails', async () => {
    const { repository, findAccessibleById, scheduleDraft } = repositoryMock();
    findAccessibleById.mockResolvedValue(draft);
    scheduleDraft
      .mockRejectedValueOnce(new Error('PostgreSQL unavailable'))
      .mockResolvedValueOnce({
        ...draft,
        status: 'SCHEDULED',
        startsAt: new Date(request.startsAt),
        closesAt: new Date(request.closesAt),
        durationMinutes: 60,
      });
    const useCases = new ExamUseCases(repository);

    await expect(
      useCases.schedule(draft.id, draft.createdByUserId, request),
    ).rejects.toThrow('PostgreSQL unavailable');
    await expect(
      useCases.schedule(draft.id, draft.createdByUserId, request),
    ).resolves.toMatchObject({ status: 'SCHEDULED' });

    expect(scheduleDraft).toHaveBeenCalledTimes(2);
  });
});

describe('ExamUseCases updates', () => {
  it('updates only the supplied PostgreSQL metadata', async () => {
    const { repository, findAccessibleById, updateMetadata } = repositoryMock();
    findAccessibleById.mockResolvedValue(draft);
    updateMetadata.mockResolvedValue({ ...draft, name: 'Updated final' });

    await new ExamUseCases(repository).updateMetadata(
      draft.id,
      draft.createdByUserId,
      { name: 'Updated final' },
    );

    expect(updateMetadata).toHaveBeenCalledWith(
      draft.id,
      'INSTITUTIONAL',
      draft.createdByUserId,
      {
        name: 'Updated final',
      },
    );
  });

  it('updates Mongo content for a scheduled exam', async () => {
    const { repository, findAccessibleById, updateContent } = repositoryMock();
    findAccessibleById.mockResolvedValue({ ...draft, status: 'SCHEDULED' });
    updateContent.mockResolvedValue({
      examId: draft.id,
      totalQuestions: request.questions.length,
      questions: request.questions,
    });

    const result = await new ExamUseCases(repository).updateContent(
      draft.id,
      draft.createdByUserId,
      { questions: request.questions },
    );

    expect(updateContent).toHaveBeenCalledWith(draft.id, {
      questions: request.questions,
    });
    expect(result.totalQuestions).toBe(1);
  });

  it('rejects updates after an exam starts running', async () => {
    const { repository, findAccessibleById, updateMetadata } = repositoryMock();
    findAccessibleById.mockResolvedValue({ ...draft, status: 'RUNNING' });

    await expect(
      new ExamUseCases(repository).updateMetadata(
        draft.id,
        draft.createdByUserId,
        { name: 'Too late' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updateMetadata).not.toHaveBeenCalled();
  });
});
