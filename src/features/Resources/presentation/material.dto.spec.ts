import {
  createResourceSchema,
  orderSchema,
  pinSchema,
  publicQuerySchema,
  updateResourceSchema,
  uploadSchema,
} from './material.dto';

describe('material boundary validation', () => {
  const create = { title: 'Lesson', type: 'VIDEO', accessPolicy: 'FREE' };
  it('requires explicit policy and rejects ARTICLE uploads and identity spoofing', () => {
    expect(
      createResourceSchema.safeParse({ title: 'Book', type: 'PDF' }).success,
    ).toBe(false);
    for (const spoof of [
      { type: 'ARTICLE' },
      { ownerUserId: 'other' },
      { uploadedByUserId: 'other' },
      { role: 'GLOBAL_ADMIN' },
      { publicURL: 'https://evil.test' },
    ])
      expect(
        createResourceSchema.safeParse({ ...create, ...spoof }).success,
      ).toBe(false);
  });
  it('preserves leading zeroes and enforces PIN length', () => {
    expect(pinSchema.parse('001234')).toBe('001234');
    for (const pin of [123456, '12345', '1234567890123', 'abcdef'])
      expect(pinSchema.safeParse(pin).success).toBe(false);
  });
  it('rejects immutable scope updates and missing versions', () => {
    expect(updateResourceSchema.safeParse({ title: 'Changed' }).success).toBe(
      false,
    );
    expect(
      updateResourceSchema.safeParse({ version: 1, institutionId: 'other' })
        .success,
    ).toBe(false);
  });
  it('rejects locator spoofing and collection purposes on resource uploads', () => {
    const upload = {
      version: 1,
      purpose: 'RESOURCE_CONTENT',
      fileType: 'video/mp4',
      sizeBytes: 50,
    };
    expect(uploadSchema.safeParse(upload).success).toBe(true);
    expect(uploadSchema.safeParse({ ...upload, reference: {} }).success).toBe(
      false,
    );
    expect(
      uploadSchema.safeParse({ ...upload, purpose: 'COLLECTION_COVER' })
        .success,
    ).toBe(false);
  });
  it('allowlists public queries and caps pagination', () => {
    expect(publicQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      sort: 'newest',
    });
    for (const query of [
      { limit: 101 },
      { status: 'DRAFT' },
      { ownerUserId: 'owner' },
      { sort: 'SQL' },
    ])
      expect(publicQuerySchema.safeParse(query).success).toBe(false);
  });
  it('rejects duplicate reorder IDs', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    expect(
      orderSchema.safeParse({ version: 1, resourceIds: [id, id] }).success,
    ).toBe(false);
  });
});
