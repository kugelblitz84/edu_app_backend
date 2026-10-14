import { profileUsernameSchema, updateProfileSchema } from './profile.dto';

describe('profile DTO schemas', () => {
  it('trims valid profile updates and allows clearing the avatar', () => {
    expect(
      updateProfileSchema.parse({
        username: ' learner_02 ',
        fullName: ' Learner Two ',
        avatarUrl: null,
      }),
    ).toEqual({
      username: 'learner_02',
      fullName: 'Learner Two',
      avatarUrl: null,
    });
  });

  it('rejects empty updates and unknown fields', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(
      updateProfileSchema.safeParse({ fullName: 'User', email: 'x@y.test' })
        .success,
    ).toBe(false);
  });

  it('validates usernames used in profile paths', () => {
    expect(profileUsernameSchema.parse(' learner_01 ')).toBe('learner_01');
    expect(profileUsernameSchema.safeParse('no spaces').success).toBe(false);
  });
});
