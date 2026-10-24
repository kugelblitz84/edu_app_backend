type MockMethods<T> = {
  [Key in keyof T]: T[Key] extends (...args: infer Args) => infer Result
    ? jest.Mock<Result, Args>
    : never;
};
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StorageError } from '../../../core/modules/storage/domain/storage.errors';
import type { StorageProvider } from '../../../core/modules/storage/domain/contracts';
import type { UploadUrlResponse } from '../../../core/modules/storage/domain/storage.types';
import { ProfilePictureUseCases } from './profile-picture.usecases';
import type {
  ProfilePictureRepository,
  ProfilePictureUpload,
} from './profile-picture.contracts';

const reference = {
  provider: 'CLOUDINARY',
  locator: { key: 'server-key', format: 'jpg' },
};
const pending: ProfilePictureUpload = {
  id: '00000000-0000-4000-8000-000000000000',
  userId: 'owner',
  fileType: 'image/jpeg',
  sizeBytes: 100,
  reference,
  expiresAt: new Date(Date.now() + 3600000),
  completedAt: null,
  isCurrent: false,
};
const upload: UploadUrlResponse = {
  fileId: pending.id,
  url: 'https://example.com/upload',
  method: 'POST',
  fields: { signature: 'signed' },
  reference,
  expiresAt: Math.floor(pending.expiresAt.getTime() / 1000),
};

describe('ProfilePictureUseCases', () => {
  let repository: MockMethods<ProfilePictureRepository>;
  let storage: MockMethods<StorageProvider>;
  let service: ProfilePictureUseCases;
  beforeEach(() => {
    repository = {
      savePending: jest.fn<
        ReturnType<ProfilePictureRepository['savePending']>,
        Parameters<ProfilePictureRepository['savePending']>
      >(),
      findUpload: jest
        .fn<
          ReturnType<ProfilePictureRepository['findUpload']>,
          Parameters<ProfilePictureRepository['findUpload']>
        >()
        .mockResolvedValue(pending),
      findCurrent: jest
        .fn<
          ReturnType<ProfilePictureRepository['findCurrent']>,
          Parameters<ProfilePictureRepository['findCurrent']>
        >()
        .mockResolvedValue(null),
      activate: jest
        .fn<
          ReturnType<ProfilePictureRepository['activate']>,
          Parameters<ProfilePictureRepository['activate']>
        >()
        .mockResolvedValue(null),
    };
    storage = {
      createUploadUrl: jest
        .fn<
          ReturnType<StorageProvider['createUploadUrl']>,
          Parameters<StorageProvider['createUploadUrl']>
        >()
        .mockResolvedValue(upload),
      inspect: jest
        .fn<
          ReturnType<StorageProvider['inspect']>,
          Parameters<StorageProvider['inspect']>
        >()
        .mockResolvedValue({ reference, sizeBytes: 100 }),
      createReadAccessUrl: jest
        .fn<
          ReturnType<StorageProvider['createReadAccessUrl']>,
          Parameters<StorageProvider['createReadAccessUrl']>
        >()
        .mockResolvedValue({
          url: 'https://example.com/fresh',
          expiresAt: 100,
        }),
      delete: jest
        .fn<
          ReturnType<StorageProvider['delete']>,
          Parameters<StorageProvider['delete']>
        >()
        .mockResolvedValue(undefined),
    };
    service = new ProfilePictureUseCases(repository, storage);
  });

  it('persists owner and pending reference before returning the upload', async () => {
    await expect(
      service.createUpload('owner', { fileType: 'image/jpeg', sizeBytes: 100 }),
    ).resolves.toEqual(upload);
    expect(repository.savePending).toHaveBeenCalledWith(
      expect.objectContaining({
        id: pending.id,
        userId: 'owner',
        reference,
        sizeBytes: 100,
        completedAt: null,
      }),
    );
    expect(repository.activate).not.toHaveBeenCalled();
  });

  it.each([
    { fileType: 'application/pdf' as const, sizeBytes: 100 },
    { fileType: 'image/png' as const, sizeBytes: 5242881 },
  ])('rejects non-image or oversized requests', async (input) => {
    await expect(service.createUpload('owner', input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it('verifies the saved reference and activates it before removing the old picture', async () => {
    const previous = {
      ...pending,
      id: 'old',
      reference: { provider: 'CLOUDINARY', locator: { key: 'old' } },
    };
    repository.activate.mockResolvedValue(previous);
    await service.completeUpload('owner', pending.id);
    expect(repository.findUpload).toHaveBeenCalledWith('owner', pending.id);
    expect(storage.inspect).toHaveBeenCalledWith(reference);
    expect(repository.activate).toHaveBeenCalledWith(
      'owner',
      pending.id,
      reference,
    );
    expect(storage.delete).toHaveBeenCalledWith(previous.reference);
    expect(repository.activate.mock.invocationCallOrder[0]).toBeLessThan(
      storage.delete.mock.invocationCallOrder[0],
    );
  });

  it('does not expose or inspect another user upload', async () => {
    repository.findUpload.mockResolvedValue(null);
    await expect(
      service.completeUpload('other-user', pending.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findUpload).toHaveBeenCalledWith(
      'other-user',
      pending.id,
    );
    expect(storage.inspect).not.toHaveBeenCalled();
  });

  it('rejects expired pending uploads', async () => {
    repository.findUpload.mockResolvedValue({
      ...pending,
      expiresAt: new Date(0),
    });
    await expect(
      service.completeUpload('owner', pending.id),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.inspect).not.toHaveBeenCalled();
  });

  it('allows a retry for the current completed upload without another Admin API call', async () => {
    repository.findUpload.mockResolvedValue({
      ...pending,
      completedAt: new Date(),
      isCurrent: true,
    });
    await service.completeUpload('owner', pending.id);
    expect(storage.inspect).not.toHaveBeenCalled();
    expect(repository.activate).not.toHaveBeenCalled();
  });

  it('cannot reactivate a replaced upload', async () => {
    repository.findUpload.mockResolvedValue({
      ...pending,
      completedAt: new Date(),
      isCurrent: false,
    });
    await expect(
      service.completeUpload('owner', pending.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([0, -1, NaN, 1.5, 101, 5242881])(
    'rejects incorrect verified size %s without changing the profile',
    async (sizeBytes) => {
      storage.inspect.mockResolvedValue({ reference, sizeBytes });
      await expect(
        service.completeUpload('owner', pending.id),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.activate).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    },
  );

  it('maps storage unavailability and preserves the current picture', async () => {
    storage.inspect.mockRejectedValue(
      new StorageError('UNAVAILABLE', 'network'),
    );
    await expect(
      service.completeUpload('owner', pending.id),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.activate).not.toHaveBeenCalled();
  });

  it('resolves a fresh URL from the saved reference without inspecting', async () => {
    repository.findCurrent.mockResolvedValue({
      ...pending,
      isCurrent: true,
      completedAt: new Date(),
    });
    await expect(
      service.resolveAvatarUrl({ userId: 'owner' }, null),
    ).resolves.toBe('https://example.com/fresh');
    expect(storage.createReadAccessUrl).toHaveBeenCalledWith(reference);
    expect(storage.inspect).not.toHaveBeenCalled();
  });

  it('keeps the legacy URL when no managed avatar exists', async () => {
    await expect(
      service.resolveAvatarUrl(
        { username: 'learner' },
        'https://example.com/legacy',
      ),
    ).resolves.toBe('https://example.com/legacy');
    expect(storage.createReadAccessUrl).not.toHaveBeenCalled();
  });
});
