import { beforeEach, describe, expect, it } from 'vitest';
import {
  createIngredientService,
  getIngredientsService,
  getIngredientByIdService,
  deleteIngredientService,
  resetIngredientsForTest,
} from './ingredients.service';

describe('ingredients service', () => {
  beforeEach(() => {
    resetIngredientsForTest();
  });

  it('starts with no ingredients', async () => {
    const ingredients = await getIngredientsService();

    expect(ingredients).toEqual([]);
  });

  it('creates an ingredient', async () => {
    const ingredient = await createIngredientService({
      name: 'Flour',
      unit: 'g',
      packageSize: 5000,
      packageCost: 8.99,
    });

    expect(ingredient.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('retrieves an ingredient by ID', async () => {
    const ingredient = await createIngredientService({
      name: 'Flour',
      unit: 'g',
      packageSize: 5000,
      packageCost: 8.99,
    });

    const retrievedIngredient = await getIngredientByIdService(ingredient.id);
    expect(retrievedIngredient).toEqual(ingredient);
  });

  it('deletes an ingredient', async () => {
    const ingredient = await createIngredientService({
      name: 'Flour',
      unit: 'g',
      packageSize: 5000,
      packageCost: 8.99,
    });

    await deleteIngredientService(ingredient.id);

    await expect(getIngredientByIdService(ingredient.id)).rejects.toThrow(
      'Ingredient not found',
    );
  });

  // regression test
  it('does not reuse IDs after deleting ingredients', async () => {
    const firstIngredient = await createIngredientService({
      name: 'Flour',
      unit: 'g',
      packageSize: 5000,
      packageCost: 8.99,
    });

    await deleteIngredientService(firstIngredient.id);

    const secondIngredient = await createIngredientService({
      name: 'Sugar',
      unit: 'g',
      packageSize: 1000,
      packageCost: 3.99,
    });

    expect(secondIngredient.id).not.toBe(firstIngredient.id);
  });
});
