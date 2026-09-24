import { ConflictException } from '@nestjs/common';
import { ExamRepository } from './exam.repository';
import type { InstitutionExam } from './exam.types';
import { ExamUseCases } from './exam.usecases';

const draft: InstitutionExam = {
  id: '8dc198a1-1b0f-4fc1-914d-319917301f3e',
  institutionId: 'ed52b4d1-b69a-4705-bd3f-f946170a4813',
  name: 'Final',
  description: null,
  examDate: null,
  durationMinutes: null,
  status: 'DRAFT',
  createdByUserId: '2f273fc1-674b-4763-972c-16a87eb8a616',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const request = {
  examDate: '2026-10-01T10:00:00.000Z',
  durationMinutes: 60,
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
  const upsertExamData = jest.fn();
  const scheduleDraft = jest.fn();
  const updateMetadata = jest.fn();
  const updateContent = jest.fn();
  const repository: jest.Mocked<ExamRepository> = {
    createDraft: jest.fn(),
    findAccessibleById,
    upsertExamData,
    scheduleDraft,
    updateMetadata,
    updateContent,
  };
  return {
    repository,
    findAccessibleById,
    upsertExamData,
    scheduleDraft,
    updateMetadata,
    updateContent,
  };
}

describe('ExamUseCases scheduling', () => {
  it('writes Mongo before transitioning PostgreSQL to SCHEDULED', async () => {
    const order: string[] = [];
    const { repository, findAccessibleById, upsertExamData, scheduleDraft } =
      repositoryMock();
    findAccessibleById.mockResolvedValue(draft);
    upsertExamData.mockImplementation(() => {
      order.push('mongo');
      return Promise.resolve();
    });
    scheduleDraft.mockImplementation(() => {
      order.push('postgres');
      return Promise.resolve({
        ...draft,
        status: 'SCHEDULED',
        examDate: new Date(request.examDate),
        durationMinutes: 60,
      });
    });

    const result = await new ExamUseCases(repository).schedule(
      draft.id,
      draft.createdByUserId,
      request,
    );

    expect(order).toEqual(['mongo', 'postgres']);
    expect(upsertExamData).toHaveBeenCalledWith(draft.id, request.questions);
    expect(result.status).toBe('SCHEDULED');
  });

  it('does not write Mongo when the exam is no longer DRAFT', async () => {
    const { repository, findAccessibleById, upsertExamData, scheduleDraft } =
      repositoryMock();
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
    expect(upsertExamData).not.toHaveBeenCalled();
    expect(scheduleDraft).not.toHaveBeenCalled();
  });

  it('can retry the same request after PostgreSQL fails', async () => {
    const { repository, findAccessibleById, upsertExamData, scheduleDraft } =
      repositoryMock();
    findAccessibleById.mockResolvedValue(draft);
    upsertExamData.mockResolvedValue();
    scheduleDraft
      .mockRejectedValueOnce(new Error('PostgreSQL unavailable'))
      .mockResolvedValueOnce({
        ...draft,
        status: 'SCHEDULED',
        examDate: new Date(request.examDate),
        durationMinutes: 60,
      });
    const useCases = new ExamUseCases(repository);

    await expect(
      useCases.schedule(draft.id, draft.createdByUserId, request),
    ).rejects.toThrow('PostgreSQL unavailable');
    await expect(
      useCases.schedule(draft.id, draft.createdByUserId, request),
    ).resolves.toMatchObject({ status: 'SCHEDULED' });

    expect(upsertExamData).toHaveBeenCalledTimes(2);
    expect(upsertExamData).toHaveBeenNthCalledWith(
      1,
      draft.id,
      request.questions,
    );
    expect(upsertExamData).toHaveBeenNthCalledWith(
      2,
      draft.id,
      request.questions,
    );
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

    expect(updateMetadata).toHaveBeenCalledWith(draft.id, {
      name: 'Updated final',
    });
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
