import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  UsernameConflictError,
  UserProfileRepository,
  type OwnUserProfile,
  type PublicUserProfile,
  type UpdateUserProfile,
} from './user-profile.contracts';
import { UserProfileUseCases } from './user-profile.usecases';

const ownProfile: OwnUserProfile = {
  id: '4ba92b76-c538-4195-9ff3-89ce9b039264',
  email: 'learner@example.com',
  username: 'learner_01',
  fullName: 'Learner One',
  avatarUrl: null,
};

class FakeUserProfileRepository implements UserProfileRepository {
  usernameConflict = false;
  profile: OwnUserProfile | null = ownProfile;

  findById(): Promise<OwnUserProfile | null> {
    return Promise.resolve(this.profile);
  }

  findByUsername(): Promise<PublicUserProfile | null> {
    if (!this.profile) return Promise.resolve(null);
    const { username, fullName, avatarUrl } = this.profile;
    return Promise.resolve({ username, fullName, avatarUrl });
  }

  update(
    _userId: string,
    update: UpdateUserProfile,
  ): Promise<OwnUserProfile | null> {
    if (this.usernameConflict) throw new UsernameConflictError();
    if (!this.profile) return Promise.resolve(null);
    this.profile = { ...this.profile, ...update };
    return Promise.resolve(this.profile);
  }
}

describe('UserProfileUseCases', () => {
  let repository: FakeUserProfileRepository;
  let useCases: UserProfileUseCases;

  beforeEach(() => {
    repository = new FakeUserProfileRepository();
    useCases = new UserProfileUseCases(repository);
  });

  it('returns the authenticated user profile', async () => {
    await expect(useCases.getOwnProfile(ownProfile.id)).resolves.toEqual(
      ownProfile,
    );
  });

  it('returns only public profile fields for a username', async () => {
    await expect(
      useCases.getPublicProfile(ownProfile.username),
    ).resolves.toEqual({
      username: ownProfile.username,
      fullName: ownProfile.fullName,
      avatarUrl: ownProfile.avatarUrl,
    });
  });

  it('updates the authenticated user profile', async () => {
    await expect(
      useCases.updateOwnProfile(ownProfile.id, {
        fullName: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    ).resolves.toMatchObject({
      fullName: 'Updated Name',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('maps duplicate usernames to an HTTP conflict', async () => {
    repository.usernameConflict = true;
    await expect(
      useCases.updateOwnProfile(ownProfile.id, { username: 'taken_name' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found for unavailable profiles', async () => {
    repository.profile = null;
    await expect(useCases.getOwnProfile(ownProfile.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      useCases.getPublicProfile(ownProfile.username),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
