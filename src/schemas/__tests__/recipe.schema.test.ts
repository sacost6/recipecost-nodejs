import { describe, expect, it } from 'vitest';
import {
  createRecipeSchema,
  recipeParamsSchema,
  updateRecipeSchema,
} from '../recipe.schema';

const recipeId = '9007199254740993';
const body = {
  name: 'Pancakes',
  servings: 4,
  instructions: 'Mix and cook.',
};

describe('create recipe schema', () => {
  it('trims text and defaults omitted instructions', () => {
    expect(
      createRecipeSchema.parse({
        body: { name: ' Pancakes ', servings: 4 },
      }),
    ).toEqual({ body: { name: 'Pancakes', servings: 4, instructions: '' } });
  });

  it('accepts nullable descriptions and the maximum positive smallint servings', () => {
    expect(
      createRecipeSchema.parse({
        body: { ...body, description: null, servings: 32767 },
      }).body,
    ).toEqual({ ...body, description: null, servings: 32767 });
  });

  it.each([
    { name: '', servings: 1 },
    { name: '   ', servings: 1 },
    { name: 'x'.repeat(151), servings: 1 },
    { name: 'Valid', servings: 0 },
    { name: 'Valid', servings: 32768 },
    { name: 'Valid', servings: 1.5 },
    { name: 'Valid', servings: '2' },
  ])('rejects malformed recipe data: %j', (invalid) => {
    expect(createRecipeSchema.safeParse({ body: invalid }).success).toBe(false);
  });

  it.each(['userId', 'recipeId', 'ingredients', 'cost', 'version'])(
    'rejects client-supplied field %s',
    (field) => {
      expect(
        createRecipeSchema.safeParse({ body: { ...body, [field]: 'forged' } })
          .success,
      ).toBe(false);
    },
  );
});

describe('recipe path and update schemas', () => {
  it('validates and preserves bigint recipe IDs', () => {
    expect(
      recipeParamsSchema.parse({ params: { recipeId: ` ${recipeId} ` } }),
    ).toEqual({ params: { recipeId } });
  });

  it('requires a changed field and a valid version for updates', () => {
    expect(
      updateRecipeSchema.safeParse({ params: { recipeId }, body: {} }).success,
    ).toBe(false);
    expect(
      updateRecipeSchema.parse({
        params: { recipeId },
        body: { description: null, version: 2 },
      }),
    ).toEqual({
      params: { recipeId },
      body: { description: null, version: 2 },
    });
    expect(
      updateRecipeSchema.safeParse({
        params: { recipeId },
        body: { version: 2 },
      }).success,
    ).toBe(false);
    expect(
      updateRecipeSchema.safeParse({
        params: { recipeId },
        body: { name: 'Updated', version: 0 },
      }).success,
    ).toBe(false);
    expect(
      updateRecipeSchema.safeParse({
        params: { recipeId },
        body: { name: 'Updated' },
      }).success,
    ).toBe(false);
  });

  it('rejects unknown update fields and invalid IDs', () => {
    expect(
      updateRecipeSchema.safeParse({
        params: { recipeId },
        body: { name: 'Updated', version: 1, userId: 'forged' },
      }).success,
    ).toBe(false);
    expect(
      recipeParamsSchema.safeParse({ params: { recipeId: '0' } }).success,
    ).toBe(false);
  });
});
