import { HttpError } from '../middleware/errorHandling/error';
import { Recipe } from '../entities/Recipe';
import { recipeRepository } from '../repositories/recipe.repo';
import { CreateRecipeInput, UpdateRecipeInput } from '../schemas/recipe.schema';
import { RecipeRow } from './utils/databaseRowTypes';
import { entityFromRow } from './utils/entityFromRow';
import { requireUpdatedRow } from './utils/requireUpdatedRow';

export const getRecipesService = async (userId: string): Promise<Recipe[]> => {
  return recipeRepository.find({
    where: { userId },
    relations: { ingredients: true },
    order: { name: 'ASC' },
  });
};

export const getRecipeByIdService = async (
  userId: string,
  recipeId: string,
): Promise<Recipe> => {
  const recipe = await recipeRepository.findOne({
    where: { recipeId, userId },
    relations: { ingredients: true },
  });

  if (!recipe) {
    throw new HttpError(404, 'Recipe not found');
  }

  return recipe;
};

export const createRecipeService = async (
  userId: string,
  input: CreateRecipeInput,
): Promise<Recipe> => {
  const recipe = recipeRepository.create({
    userId, // Always use the authenticated user's ID
    name: input.name,
    description: input.description ?? null,
    instructions: input.instructions,
    servings: input.servings,
  });

  return recipeRepository.save(recipe);
};

export const updateRecipeService = async (
  userId: string,
  recipeId: string,
  input: UpdateRecipeInput,
): Promise<Recipe> => {
  const { version: expectedVersion, ...changes } = input;
  const result = await recipeRepository.update(
    { recipeId, userId, version: expectedVersion },
    changes,
    { returning: '*' },
  );

  const row = await requireUpdatedRow(
    result.raw as RecipeRow[],
    () => recipeRepository.existsBy({ recipeId, userId }),
    'Recipe',
  );

  return entityFromRow(recipeRepository, row);
};

export const deleteRecipeService = async (
  userId: string,
  recipeId: string,
): Promise<void> => {
  const recipe = await getRecipeByIdService(userId, recipeId);

  await recipeRepository.remove(recipe);
};
