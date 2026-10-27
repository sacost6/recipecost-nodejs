import { describe, expect, it } from 'vitest';
import { retailerParamsSchema } from '../retailer.schema';

describe('retailer path schema', () => {
  it('preserves a trimmed PostgreSQL bigint retailer ID', () => {
    expect(
      retailerParamsSchema.parse({
        params: { retailerId: ' 9223372036854775807 ' },
      }),
    ).toEqual({ params: { retailerId: '9223372036854775807' } });
  });

  it.each(['0', '-1', '01', '1.5', '9223372036854775808', 1, null])(
    'rejects invalid retailer ID %j',
    (retailerId) => {
      expect(
        retailerParamsSchema.safeParse({ params: { retailerId } }).success,
      ).toBe(false);
    },
  );
});
