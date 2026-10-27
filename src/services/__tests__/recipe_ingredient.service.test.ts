import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../middleware/errorHandling/error';
import {
  createRecipeIngredientService,
  deleteRecipeIngredientService,
  getRecipeIngredientsService,
  updateRecipeIngredientService,
} from '../recipe_ingredient.service';

const recipes = vi.hoisted(() => ({ findOneBy: vi.fn() }));
const ingredients = vi.hoisted(() => ({ findOne: vi.fn() }));
const units = vi.hoisted(() => ({ findOneBy: vi.fn() }));
const lines = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../repositories/recipe.repo', () => ({
  recipeRepository: recipes,
}));
vi.mock('../../repositories/ingredient.repo', () => ({
  ingredientRepository: ingredients,
}));
vi.mock('../../repositories/unit.repo', () => ({ unitRepository: units }));
vi.mock('../../repositories/recipe_ingredient.repo', () => ({
  recipeIngredientRepository: lines,
}));

const userId = '9007199254740993';
const recipeId = '9007199254740995';
const recipeIngredientId = '9007199254740997';
const ingredientId = '9007199254740999';
const ingredient = { ingredientId, userId: null, name: 'Flour' };
const unit = { unitId: 1, name: 'Gram', abbreviation: 'g' };
const recipeIngredient = {
  recipeIngredientId,
  recipeId,
  ingredientId,
  quantity: '250.0000',
  unitId: unit.unitId,
  sortOrder: 0,
  ingredient,
  unit,
};

beforeEach(() => {
  vi.resetAllMocks();
  recipes.findOneBy.mockResolvedValue({ recipeId, userId });
  ingredients.findOne.mockResolvedValue(ingredient);
  units.findOneBy.mockResolvedValue(unit);
  lines.create.mockImplementation((input) => ({ ...input }));
  lines.save.mockImplementation(async (value) => ({
    ...value,
    recipeIngredientId,
  }));
  lines.find.mockResolvedValue([recipeIngredient]);
  lines.findOne.mockResolvedValue(recipeIngredient);
  lines.delete.mockResolvedValue({ affected: 1 });
});

describe('recipe ingredient reads', () => {
  it('checks recipe ownership before listing its ingredients in display order', async () => {
    await expect(
      getRecipeIngredientsService(userId, recipeId),
    ).resolves.toEqual([recipeIngredient]);

    expect(recipes.findOneBy).toHaveBeenCalledExactlyOnceWith({
      recipeId,
      userId,
    });
    expect(lines.find).toHaveBeenCalledExactlyOnceWith({
      where: { recipeId },
      relations: { ingredient: true, unit: true },
      order: { sortOrder: 'ASC', recipeIngredientId: 'ASC' },
    });
  });

  it('does not expose ingredients when the recipe belongs to another user', async () => {
    recipes.findOneBy.mockResolvedValue(null);

    await expect(getRecipeIngredientsService(userId, recipeId)).rejects.toEqual(
      new HttpError(404, 'Recipe not found'),
    );
    expect(lines.find).not.toHaveBeenCalled();
  });
});

describe('recipe ingredient creation', () => {
  it('checks recipe ownership, ingredient visibility, and unit before saving', async () => {
    const input = {
      ingredientId,
      quantity: '250.0000',
      unitId: 1,
    };

    await expect(
      createRecipeIngredientService(userId, recipeId, input),
    ).resolves.toBe(recipeIngredient);

    expect(ingredients.findOne).toHaveBeenCalledTimes(1);
    const visibilityFilters = ingredients.findOne.mock.calls[0][0].where;
    expect(visibilityFilters).toHaveLength(2);
    expect(visibilityFilters[0].ingredientId).toBe(ingredientId);
    expect(visibilityFilters[1]).toEqual({ ingredientId, userId });
    expect(lines.create).toHaveBeenCalledExactlyOnceWith({
      ...input,
      recipeId,
      sortOrder: 0,
    });
    expect(lines.save).toHaveBeenCalledTimes(1);
    expect(lines.findOne).toHaveBeenCalledWith({
      where: { recipeId, recipeIngredientId },
      relations: { ingredient: true, unit: true },
    });
  });

  it('does not write when the recipe is not owned by the caller', async () => {
    recipes.findOneBy.mockResolvedValue(null);

    await expect(
      createRecipeIngredientService(userId, recipeId, {
        ingredientId,
        quantity: '1.0000',
        unitId: 1,
      }),
    ).rejects.toEqual(new HttpError(404, 'Recipe not found'));
    expect(ingredients.findOne).not.toHaveBeenCalled();
    expect(lines.save).not.toHaveBeenCalled();
  });

  it('returns not found for an unavailable ingredient or unit', async () => {
    ingredients.findOne.mockResolvedValue(null);
    await expect(
      createRecipeIngredientService(userId, recipeId, {
        ingredientId,
        quantity: '1.0000',
        unitId: 1,
      }),
    ).rejects.toEqual(new HttpError(404, 'Ingredient not found'));

    ingredients.findOne.mockResolvedValue(ingredient);
    units.findOneBy.mockResolvedValue(null);
    await expect(
      createRecipeIngredientService(userId, recipeId, {
        ingredientId,
        quantity: '1.0000',
        unitId: 1,
      }),
    ).rejects.toEqual(new HttpError(404, 'Unit not found'));
    expect(lines.save).not.toHaveBeenCalled();
  });
});

describe('recipe ingredient updates and deletion', () => {
  it('updates only provided fields and resolves the new ingredient and unit relations', async () => {
    const existing = { ...recipeIngredient };
    const replacementIngredient = {
      ingredientId: '123',
      userId,
      name: 'Sugar',
    };
    const replacementUnit = { unitId: 2, name: 'Kilogram', abbreviation: 'kg' };
    ingredients.findOne.mockResolvedValue(replacementIngredient);
    units.findOneBy.mockResolvedValue(replacementUnit);
    lines.findOne
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing);

    const result = await updateRecipeIngredientService(
      userId,
      recipeId,
      recipeIngredientId,
      {
        ingredientId: replacementIngredient.ingredientId,
        unitId: replacementUnit.unitId,
        sortOrder: 3,
      },
    );

    expect(result).toBe(existing);
    expect(existing).toMatchObject({
      ingredientId: replacementIngredient.ingredientId,
      ingredient: replacementIngredient,
      unitId: replacementUnit.unitId,
      unit: replacementUnit,
      sortOrder: 3,
      quantity: '250.0000',
    });
    expect(lines.save).toHaveBeenCalledExactlyOnceWith(existing);
  });

  it('deletes using the recipe and recipe-ingredient IDs after ownership check', async () => {
    await expect(
      deleteRecipeIngredientService(userId, recipeId, recipeIngredientId),
    ).resolves.toBeUndefined();

    expect(recipes.findOneBy).toHaveBeenCalledExactlyOnceWith({
      recipeId,
      userId,
    });
    expect(lines.delete).toHaveBeenCalledExactlyOnceWith({
      recipeId,
      recipeIngredientId,
    });
  });

  it('returns 404 if the recipe ingredient does not belong to the specified recipe', async () => {
    lines.delete.mockResolvedValue({ affected: 0 });

    await expect(
      deleteRecipeIngredientService(userId, recipeId, recipeIngredientId),
    ).rejects.toEqual(new HttpError(404, 'Recipe ingredient not found'));
  });
});
