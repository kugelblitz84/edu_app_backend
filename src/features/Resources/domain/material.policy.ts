import type { AccessDecision, Material, ViewerFacts } from './material.types';

/** Pure rules shared by metadata, previews, and both delivery contexts. */
export function manages(item: Material, facts: ViewerFacts): boolean {
  return item.institutionId
    ? facts.admin && facts.institutionActive
    : item.ownerUserId === facts.userId;
}
export function visible(
  item: Material,
  facts: ViewerFacts,
  collectionContext = false,
): boolean {
  if (item.status === 'DELETED') return false;
  if (manages(item, facts)) return true;
  return (
    item.status === 'PUBLISHED' &&
    item.accessPolicy !== 'OWNER_ONLY' &&
    (!item.institutionId || facts.institutionActive) &&
    (item.kind === 'COLLECTION' ||
      item.isStandalone === true ||
      collectionContext)
  );
}
export function access(item: Material, facts: ViewerFacts): AccessDecision {
  if (
    item.status !== 'PUBLISHED' ||
    (item.institutionId && !facts.institutionActive)
  )
    return { canAccess: false, reason: 'UNAVAILABLE' };
  if (manages(item, facts))
    return {
      canAccess: true,
      source: item.institutionId ? 'INSTITUTION_ADMIN' : 'OWNER',
    };
  if (item.accessPolicy === 'FREE') return { canAccess: true, source: 'FREE' };
  if (!facts.userId) return { canAccess: false, reason: 'AUTH_REQUIRED' };
  if (item.accessPolicy === 'OWNER_ONLY')
    return { canAccess: false, reason: 'OWNER_ONLY' };
  if (item.accessPolicy === 'ENROLLED')
    return facts.enrolled
      ? { canAccess: true, source: 'ENROLLMENT' }
      : { canAccess: false, reason: 'ENROLLMENT_REQUIRED' };
  return facts.grant
    ? {
        canAccess: true,
        source: item.kind === 'COLLECTION' ? 'COLLECTION_PIN' : 'RESOURCE_PIN',
      }
    : { canAccess: false, reason: 'PIN_REQUIRED' };
}
export function compatible(collection: Material, resource: Material): boolean {
  if (collection.kind !== 'COLLECTION' || resource.kind !== 'RESOURCE')
    return false;
  if (collection.institutionId !== resource.institutionId) return false;
  if (
    !collection.institutionId &&
    collection.ownerUserId !== resource.ownerUserId
  )
    return false;
  const allowed = {
    FREE: ['FREE'],
    OWNER_ONLY: ['FREE', 'OWNER_ONLY', 'ENROLLED', 'PURCHASE'],
    ENROLLED: ['FREE', 'ENROLLED'],
    PURCHASE: ['FREE', 'PURCHASE'],
  };
  return allowed[collection.accessPolicy].includes(resource.accessPolicy);
}
export function validScope(
  policy: Material['accessPolicy'],
  institutionId: string | null,
): boolean {
  if (policy === 'ENROLLED') return !!institutionId;
  if (policy === 'OWNER_ONLY' || policy === 'PURCHASE') return !institutionId;
  return true;
}
export function validGrant(
  grant: {
    unlockVersion: number;
    revokedAt: Date | null;
    expiresAt: Date | null;
  } | null,
  item: Material,
  now: Date,
): boolean {
  return (
    !!grant &&
    grant.unlockVersion === item.unlockVersion &&
    !grant.revokedAt &&
    (!grant.expiresAt || grant.expiresAt > now)
  );
}
