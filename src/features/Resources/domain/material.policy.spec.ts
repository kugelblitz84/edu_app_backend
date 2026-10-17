import {
  access,
  compatible,
  manages,
  validGrant,
  validScope,
  visible,
} from './material.policy';
import type { Material, Policy, ViewerFacts } from './material.types';

export const fixture = (changes: Partial<Material> = {}): Material => ({
  id: 'resource',
  kind: 'RESOURCE',
  type: 'PDF',
  isStandalone: true,
  title: 'Book',
  description: null,
  ownerUserId: 'owner',
  institutionId: null,
  accessPolicy: 'FREE',
  status: 'PUBLISHED',
  priceAmountMinor: null,
  currency: null,
  pinHash: null,
  unlockVersion: 1,
  version: 1,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  publishedAt: new Date(),
  archivedAt: null,
  deletedAt: null,
  ...changes,
});
const viewer: ViewerFacts = {
  admin: false,
  institutionActive: true,
  enrolled: false,
  grant: false,
};

describe('material access policies', () => {
  it('allows anonymous FREE delivery and requires authentication for protected policies', () => {
    expect(access(fixture(), viewer)).toEqual({
      canAccess: true,
      source: 'FREE',
    });
    for (const accessPolicy of [
      'OWNER_ONLY',
      'ENROLLED',
      'PURCHASE',
    ] as Policy[])
      expect(access(fixture({ accessPolicy }), viewer)).toEqual({
        canAccess: false,
        reason: 'AUTH_REQUIRED',
      });
  });
  it('hides owner-only metadata and all nonpublished metadata from other viewers', () => {
    for (const status of ['DRAFT', 'ARCHIVED', 'DELETED'] as const)
      expect(visible(fixture({ status }), viewer)).toBe(false);
    expect(
      visible(fixture({ accessPolicy: 'OWNER_ONLY' }), {
        ...viewer,
        userId: 'other',
      }),
    ).toBe(false);
    expect(
      visible(fixture({ accessPolicy: 'OWNER_ONLY' }), {
        ...viewer,
        userId: 'owner',
      }),
    ).toBe(true);
    expect(
      visible(fixture({ status: 'DELETED' }), { ...viewer, userId: 'owner' }),
    ).toBe(false);
  });
  it('does not preserve former institution admin rights through attribution', () => {
    const item = fixture({
      institutionId: 'school',
      accessPolicy: 'ENROLLED',
      status: 'DRAFT',
    });
    expect(manages(item, { ...viewer, userId: 'owner' })).toBe(false);
    expect(manages(item, { ...viewer, userId: 'admin', admin: true })).toBe(
      true,
    );
    expect(
      manages(item, {
        ...viewer,
        userId: 'admin',
        admin: true,
        institutionActive: false,
      }),
    ).toBe(false);
  });
  it('keeps enrollment metadata public and grants media only to enrollment or admins', () => {
    const item = fixture({ institutionId: 'school', accessPolicy: 'ENROLLED' });
    expect(visible(item, viewer)).toBe(true);
    expect(access(item, { ...viewer, userId: 'student' })).toEqual({
      canAccess: false,
      reason: 'ENROLLMENT_REQUIRED',
    });
    expect(
      access(item, { ...viewer, userId: 'student', enrolled: true }),
    ).toEqual({ canAccess: true, source: 'ENROLLMENT' });
    expect(access(item, { ...viewer, userId: 'admin', admin: true })).toEqual({
      canAccess: true,
      source: 'INSTITUTION_ADMIN',
    });
    expect(
      access(item, {
        ...viewer,
        userId: 'admin',
        admin: true,
        institutionActive: false,
      }),
    ).toEqual({ canAccess: false, reason: 'UNAVAILABLE' });
  });
  it('requires a current exact-target PIN grant and distinguishes collection source', () => {
    expect(
      access(fixture({ accessPolicy: 'PURCHASE' }), {
        ...viewer,
        userId: 'other',
      }),
    ).toEqual({ canAccess: false, reason: 'PIN_REQUIRED' });
    expect(
      access(fixture({ accessPolicy: 'PURCHASE', kind: 'COLLECTION' }), {
        ...viewer,
        userId: 'other',
        grant: true,
      }),
    ).toEqual({ canAccess: true, source: 'COLLECTION_PIN' });
  });
  it('checks grant version, revocation and the exact expiry boundary', () => {
    const now = new Date();
    const grant = { unlockVersion: 1, revokedAt: null, expiresAt: null };
    expect(validGrant(grant, fixture(), now)).toBe(true);
    expect(validGrant({ ...grant, unlockVersion: 2 }, fixture(), now)).toBe(
      false,
    );
    expect(validGrant({ ...grant, revokedAt: now }, fixture(), now)).toBe(
      false,
    );
    expect(validGrant({ ...grant, expiresAt: now }, fixture(), now)).toBe(
      false,
    );
  });
  it('keeps collection-only records hidden from standalone lookup', () => {
    const item = fixture({ isStandalone: false });
    expect(visible(item, viewer)).toBe(false);
    expect(visible(item, viewer, true)).toBe(true);
    expect(visible(item, { ...viewer, userId: 'owner' })).toBe(true);
  });
  it.each([
    ['FREE', ['FREE']],
    ['OWNER_ONLY', ['FREE', 'OWNER_ONLY', 'ENROLLED', 'PURCHASE']],
    ['ENROLLED', ['FREE', 'ENROLLED']],
    ['PURCHASE', ['FREE', 'PURCHASE']],
  ] as [Policy, Policy[]][])(
    'enforces the complete %s collection matrix',
    (policy, allowed) => {
      for (const child of [
        'FREE',
        'OWNER_ONLY',
        'ENROLLED',
        'PURCHASE',
      ] as Policy[]) {
        const institutionId = policy === 'ENROLLED' ? 'school' : null;
        expect(
          compatible(
            fixture({
              kind: 'COLLECTION',
              accessPolicy: policy,
              institutionId,
            }),
            fixture({ accessPolicy: child, institutionId }),
          ),
        ).toBe(allowed.includes(child));
      }
    },
  );
  it('rejects cross-owner and cross-institution repackaging', () => {
    expect(
      compatible(
        fixture({ kind: 'COLLECTION' }),
        fixture({ ownerUserId: 'other' }),
      ),
    ).toBe(false);
    expect(
      compatible(
        fixture({
          kind: 'COLLECTION',
          institutionId: 'A',
          accessPolicy: 'ENROLLED',
        }),
        fixture({ institutionId: 'B', accessPolicy: 'ENROLLED' }),
      ),
    ).toBe(false);
  });
  it('requires institutions only for allowed policies', () => {
    expect(validScope('ENROLLED', null)).toBe(false);
    expect(validScope('PURCHASE', 'school')).toBe(false);
    expect(validScope('OWNER_ONLY', 'school')).toBe(false);
    expect(validScope('FREE', 'school')).toBe(true);
  });
});
