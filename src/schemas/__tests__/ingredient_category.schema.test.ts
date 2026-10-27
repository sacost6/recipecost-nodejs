import { describe, expect, it } from 'vitest';
import { ingredientCategoryParamsSchema } from '../ingredient_category.schema';

describe('ingredient category params', () => {
  it.each(['1', '32767', ' 12 '])('accepts an in-range ID %j', (categoryId) => {
    expect(
      ingredientCategoryParamsSchema.parse({ params: { categoryId } }).params
        .categoryId,
    ).toBe(categoryId);
  });

  it.each(['0', '-1', '32768', 'NaN', 'Infinity', '', ' '])(
    'rejects an invalid smallint ID %j',
    (categoryId) => {
      expect(
        ingredientCategoryParamsSchema.safeParse({ params: { categoryId } })
          .success,
      ).toBe(false);
    },
  );

  it('rejects a numeric value instead of an HTTP path string', () => {
    expect(
      ingredientCategoryParamsSchema.safeParse({ params: { categoryId: 12 } })
        .success,
    ).toBe(false);
  });
});
