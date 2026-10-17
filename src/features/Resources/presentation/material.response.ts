import type { Material } from '../domain/material.types';

/** Explicit projection: never serialize ORM records, references, grants, or PINs. */
export function metadata(item: Material) {
  const safeMetadata = item.metadata
    ? {
        ...(typeof item.metadata.author === 'string'
          ? { author: item.metadata.author }
          : {}),
        ...(Array.isArray(item.metadata.tags)
          ? {
              tags: item.metadata.tags.filter((tag) => typeof tag === 'string'),
            }
          : {}),
        ...(typeof item.metadata.externalLink === 'string' &&
        /^https?:\/\//.test(item.metadata.externalLink)
          ? { externalLink: item.metadata.externalLink }
          : {}),
      }
    : null;
  return {
    id: item.id,
    kind: item.kind,
    ...(item.kind === 'RESOURCE'
      ? { type: item.type, isStandalone: item.isStandalone }
      : {}),
    title: item.title,
    description: item.description,
    owner: { id: item.ownerUserId },
    institution: item.institutionId ? { id: item.institutionId } : null,
    accessPolicy: item.accessPolicy,
    status: item.status,
    priceAmountMinor: item.priceAmountMinor,
    currency: item.currency,
    hasPin: !!item.pinHash,
    version: item.version,
    metadata: safeMetadata,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt,
    archivedAt: item.archivedAt,
    deletedAt: item.deletedAt,
  };
}
