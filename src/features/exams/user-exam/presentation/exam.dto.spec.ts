import { publicExamQuerySchema } from './exam.dto';

describe('publicExamQuerySchema', () => {
  it('applies pagination and ordering defaults', () => {
    expect(publicExamQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      orderBy: 'createdAt',
      order: 'desc',
    });
  });

  it('coerces pagination and accepts supported filters', () => {
    expect(
      publicExamQuerySchema.parse({
        page: '2',
        limit: '5',
        status: 'RUNNING',
        prefix: '  Math  ',
        orderBy: 'startsAt',
        order: 'asc',
      }),
    ).toEqual({
      page: 2,
      limit: 5,
      status: 'RUNNING',
      prefix: 'Math',
      orderBy: 'startsAt',
      order: 'asc',
    });
  });

  it('does not allow private draft exams to be requested', () => {
    expect(() => publicExamQuerySchema.parse({ status: 'DRAFT' })).toThrow();
  });
});
