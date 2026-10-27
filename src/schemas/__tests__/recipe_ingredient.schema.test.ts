import { describe, expect, it } from 'vitest';
import {
  createRecipeIngredientSchema,
  deleteRecipeIngredientSchema,
  updateRecipeIngredientSchema,
} from '../recipe_ingredient.schema';

const recipeParams = { recipeId: '9007199254740993' };
const params = {
  ...recipeParams,
  recipeIngredientId: '9007199254740995',
};
const body = {
  ingredientId: '9007199254740997',
  quantity: '2.5000',
  unitId: 3,
};

describe('create recipe ingredient schema', () => {
  it('preserves exact IDs and decimal quantity and defaults sort order at the service boundary', () => {
    expect(
      createRecipeIngredientSchema.parse({
        params: recipeParams,
        body: { ...body, sortOrder: 2 },
      }),
    ).toEqual({ params: recipeParams, body: { ...body, sortOrder: 2 } });
  });

  it.each(['0', '0.0000', '-1', '1.12345', '100000000', 2.5])(
    'rejects invalid quantity %j',
    (quantity) => {
      expect(
        createRecipeIngredientSchema.safeParse({
          params,
          body: { ...body, quantity },
        }).success,
      ).toBe(false);
    },
  );

  it('rejects invalid unit, order, IDs, and client-controlled ownership fields', () => {
    for (const invalid of [
      { unitId: 0 },
      { unitId: 32768 },
      { sortOrder: -1 },
      { sortOrder: 1.1 },
      { userId: 'forged' },
    ]) {
      expect(
        createRecipeIngredientSchema.safeParse({
          params,
          body: { ...body, ...invalid },
        }).success,
      ).toBe(false);
    }
    expect(
      createRecipeIngredientSchema.safeParse({
        params: { ...params, recipeId: '9223372036854775808' },
        body,
      }).success,
    ).toBe(false);
  });
});

describe('update and delete recipe ingredient schemas', () => {
  it('allows a nonempty partial patch and rejects an empty patch', () => {
    expect(
      updateRecipeIngredientSchema.parse({
        params,
        body: { sortOrder: 0 },
      }),
    ).toEqual({ params, body: { sortOrder: 0 } });
    expect(
      updateRecipeIngredientSchema.safeParse({ params, body: {} }).success,
    ).toBe(false);
  });

  it('requires both nested path IDs for update and delete', () => {
    expect(deleteRecipeIngredientSchema.parse({ params })).toEqual({ params });
    expect(
      deleteRecipeIngredientSchema.safeParse({
        params: { recipeId: params.recipeId },
      }).success,
    ).toBe(false);
    expect(
      updateRecipeIngredientSchema.safeParse({
        params: { ...params, recipeIngredientId: '0' },
        body: { quantity: '1' },
      }).success,
    ).toBe(false);
  });

  it('rejects changes to relationship metadata not accepted by the form', () => {
    expect(
      updateRecipeIngredientSchema.safeParse({
        params,
        body: { recipeId: '123', sortOrder: 2 },
      }).success,
    ).toBe(false);
  });
});
