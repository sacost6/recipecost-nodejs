import { describe, expect, it } from 'vitest';
import { unitParamsSchema } from '../unit.schema';

describe('unit path schema', () => {
  it.each(['1', '32767', ' 8 '])('accepts an in-range unit ID %j', (unitId) => {
    expect(unitParamsSchema.parse({ params: { unitId } }).params.unitId).toBe(
      unitId,
    );
  });

  it.each(['0', '-1', '32768', 'abc', '', 'Infinity'])(
    'rejects an invalid unit ID %j',
    (unitId) => {
      expect(unitParamsSchema.safeParse({ params: { unitId } }).success).toBe(
        false,
      );
    },
  );
});
