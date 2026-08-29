import { beforeEach, describe, expect, it } from 'vitest';
import {
  createIngredientService,
  getIngredientsService,
  getIngredientByIdService,
  deleteIngredientService,
  resetIngredientsForTest,
} from '../ingredients.service';

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
      quantity: 1,
      unit: 'g',
      packageSize: 5000,
      packageCost: 8.99,
    });

    expect(ingredient.id).toBe('1');
  });

  it('retrieves an ingredient by ID', async () => {
    const ingredient = await createIngredientService({
      name: 'Flour',
      quantity: 1,
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
      quantity: 1,
      unit: 'g',
      packageSize: 5000,
      packageCost: 8.99,
    });

    await deleteIngredientService(ingredient.id);

    await expect(getIngredientByIdService(ingredient.id)).rejects.toThrow(
      'Ingredient not found',
    );
  });
});
