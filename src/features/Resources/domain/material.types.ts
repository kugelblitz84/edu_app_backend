import type { StorageReference } from '../../../core/storage/domain/storage.types';

export type Kind = 'RESOURCE' | 'COLLECTION';
export type Policy = 'FREE' | 'OWNER_ONLY' | 'ENROLLED' | 'PURCHASE';
export type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';
export type Purpose =
  'RESOURCE_CONTENT' | 'RESOURCE_THUMBNAIL' | 'COLLECTION_COVER';
export interface Material {
  id: string;
  kind: Kind;
  type?: 'PDF' | 'VIDEO' | 'ARTICLE';
  isStandalone?: boolean;
  title: string;
  description: string | null;
  ownerUserId: string;
  institutionId: string | null;
  accessPolicy: Policy;
  status: Status;
  priceAmountMinor: number | null;
  currency: string | null;
  pinHash: string | null;
  unlockVersion: number;
  version: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
}
export interface MaterialFile {
  id: string;
  resourceId: string | null;
  collectionId: string | null;
  uploaderUserId: string;
  purpose: Purpose;
  fileType: string;
  sizeBytes: number;
  reference: StorageReference;
  verifiedReference: StorageReference | null;
  verifiedSizeBytes: number | null;
  expiresAt: Date;
  state: 'PENDING' | 'READY' | 'REJECTED';
  attached: boolean;
  completedAt: Date | null;
  cleanupState: 'NONE' | 'QUEUED' | 'DONE';
}
export interface Member {
  collectionId: string;
  resourceId: string;
  position: number;
  addedByUserId: string;
  addedAt: Date;
}
export interface Grant {
  userId: string;
  unlockVersion: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
}
export interface ViewerFacts {
  userId?: string;
  admin: boolean;
  institutionActive: boolean;
  enrolled: boolean;
  grant: boolean;
}
export type AccessSource =
  | 'FREE'
  | 'OWNER'
  | 'INSTITUTION_ADMIN'
  | 'ENROLLMENT'
  | 'RESOURCE_PIN'
  | 'COLLECTION_PIN';
export type AccessDecision =
  | { canAccess: true; source: AccessSource }
  | {
      canAccess: false;
      reason:
        | 'AUTH_REQUIRED'
        | 'ENROLLMENT_REQUIRED'
        | 'PIN_REQUIRED'
        | 'OWNER_ONLY'
        | 'UNAVAILABLE';
    };
export interface CatalogQuery {
  page: number;
  limit: number;
  search?: string;
  type?: 'PDF' | 'VIDEO';
  institutionId?: string;
  accessPolicy?: Policy;
  status?: Status;
  sort: 'newest' | 'oldest' | 'title';
}
