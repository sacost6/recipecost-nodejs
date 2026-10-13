import { IsNull } from 'typeorm';
import { RecipeIngredient } from '../entities/RecipeIngredient';
import { HttpError } from '../middleware/errorHandling/error';
import { ingredientRepository } from '../repositories/ingredient.repo';
import { recipeIngredientRepository } from '../repositories/recipe_ingredient.repo';
import { recipeRepository } from '../repositories/recipe.repo';
import { unitRepository } from '../repositories/unit.repo';
import {
  CreateRecipeIngredientInput,
  UpdateRecipeIngredientInput,
} from '../schemas/recipe_ingredient.schema';

const requireOwnedRecipe = async (userId: string, recipeId: string) => {
  const recipe = await recipeRepository.findOneBy({ recipeId, userId });

  if (!recipe) {
    throw new HttpError(404, 'Recipe not found');
  }

  return recipe;
};

const requireAvailableIngredient = async (
  userId: string,
  ingredientId: string,
) => {
  const ingredient = await ingredientRepository.findOne({
    where: [
      { ingredientId, userId: IsNull() },
      { ingredientId, userId },
    ],
  });

  if (!ingredient) {
    throw new HttpError(404, 'Ingredient not found');
  }

  return ingredient;
};

const requireUnit = async (unitId: number) => {
  const unit = await unitRepository.findOneBy({ unitId });

  if (!unit) {
    throw new HttpError(404, 'Unit not found');
  }

  return unit;
};

const requireRecipeIngredient = async (
  recipeId: string,
  recipeIngredientId: string,
): Promise<RecipeIngredient> => {
  const recipeIngredient = await recipeIngredientRepository.findOne({
    where: { recipeId, recipeIngredientId },
    relations: { ingredient: true, unit: true },
  });

  if (!recipeIngredient) {
    throw new HttpError(404, 'Recipe ingredient not found');
  }

  return recipeIngredient;
};

export const getRecipeIngredientsService = async (
  userId: string,
  recipeId: string,
): Promise<RecipeIngredient[]> => {
  await requireOwnedRecipe(userId, recipeId);

  return recipeIngredientRepository.find({
    where: { recipeId },
    relations: { ingredient: true, unit: true },
    order: { sortOrder: 'ASC', recipeIngredientId: 'ASC' },
  });
};

export const createRecipeIngredientService = async (
  userId: string,
  recipeId: string,
  input: CreateRecipeIngredientInput,
): Promise<RecipeIngredient> => {
  await requireOwnedRecipe(userId, recipeId);
  await requireAvailableIngredient(userId, input.ingredientId);
  await requireUnit(input.unitId);

  const recipeIngredient = recipeIngredientRepository.create({
    recipeId,
    ingredientId: input.ingredientId,
    quantity: input.quantity,
    unitId: input.unitId,
    sortOrder: input.sortOrder ?? 0,
  });

  const saved = await recipeIngredientRepository.save(recipeIngredient);
  return requireRecipeIngredient(recipeId, saved.recipeIngredientId);
};

export const updateRecipeIngredientService = async (
  userId: string,
  recipeId: string,
  recipeIngredientId: string,
  input: UpdateRecipeIngredientInput,
): Promise<RecipeIngredient> => {
  await requireOwnedRecipe(userId, recipeId);
  const recipeIngredient = await requireRecipeIngredient(
    recipeId,
    recipeIngredientId,
  );

  if (input.ingredientId !== undefined) {
    const ingredient = await requireAvailableIngredient(
      userId,
      input.ingredientId,
    );
    recipeIngredient.ingredientId = input.ingredientId;
    recipeIngredient.ingredient = ingredient;
  }
  if (input.quantity !== undefined) recipeIngredient.quantity = input.quantity;
  if (input.unitId !== undefined) {
    const unit = await requireUnit(input.unitId);
    recipeIngredient.unitId = input.unitId;
    recipeIngredient.unit = unit;
  }
  if (input.sortOrder !== undefined) {
    recipeIngredient.sortOrder = input.sortOrder;
  }

  await recipeIngredientRepository.save(recipeIngredient);
  return requireRecipeIngredient(recipeId, recipeIngredientId);
};

export const deleteRecipeIngredientService = async (
  userId: string,
  recipeId: string,
  recipeIngredientId: string,
): Promise<void> => {
  await requireOwnedRecipe(userId, recipeId);

  const result = await recipeIngredientRepository.delete({
    recipeId,
    recipeIngredientId,
  });

  if (result.affected === 0) {
    throw new HttpError(404, 'Recipe ingredient not found');
  }
};
