import { IsNull } from 'typeorm';
import { HttpError } from '../middleware/errorHandling/error';
import { Recipe } from '../entities/Recipe';
import { recipeRepository } from '../repositories/recipe.repo';
import { CreateRecipeInput, UpdateRecipeInput } from '../schemas/recipe.schema';

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
  const recipe = await getRecipeByIdService(userId, recipeId);

  if (input.name !== undefined) recipe.name = input.name;
  if (input.description !== undefined) recipe.description = input.description;
  if (input.instructions !== undefined)
    recipe.instructions = input.instructions;
  if (input.servings !== undefined) recipe.servings = input.servings;

  return recipeRepository.save(recipe);
};
export const deleteRecipeService = async (
  userId: string,
  recipeId: string,
): Promise<void> => {
  const recipe = await getRecipeByIdService(userId, recipeId);

  await recipeRepository.remove(recipe);
};
