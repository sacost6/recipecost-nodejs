import {
  type CreateIngredientInput,
  type UpdateIngredientInput,
  type Ingredient,
} from '../schemas/ingredient.schema';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../utils/httpError';

const ingredients: Ingredient[] = [];

export const getIngredientsService = async (): Promise<Ingredient[]> => {
  return ingredients;
};

export const getIngredientByIdService = async (
  ingredientId: string,
): Promise<Ingredient | undefined> => {
  const ingredient = ingredients.find(
    (ingredient) => ingredient.id === ingredientId,
  );

  if (!ingredient) {
    throw new HttpError(404, 'Ingredient not found');
  }

  return ingredient;
};

export const createIngredientService = async (
  input: CreateIngredientInput,
): Promise<Ingredient> => {
  const newIngredient: Ingredient = {
    id: randomUUID(),
    ...input,
    costPerUnit: input.packageCost / input.packageSize,
  };

  ingredients.push(newIngredient);

  return newIngredient;
};

export const updateIngredientService = async (
  ingredientId: string | string[],
  input: UpdateIngredientInput,
): Promise<Ingredient> => {
  const ingredientIndex = ingredients.findIndex(
    (ingredient) => ingredient.id === ingredientId,
  );

  if (ingredientIndex === -1) {
    throw new HttpError(404, 'Ingredient not found');
  }

  const updatedIngredient: Ingredient = {
    ...ingredients[ingredientIndex],
    ...input,
  };

  updatedIngredient.costPerUnit =
    updatedIngredient.packageCost / updatedIngredient.packageSize;
  ingredients[ingredientIndex] = updatedIngredient;

  return updatedIngredient;
};

export const deleteIngredientService = async (
  ingredientId: string,
): Promise<void> => {
  const ingredientIndex = ingredients.findIndex(
    (ingredient) => ingredient.id === ingredientId,
  );

  if (ingredientIndex === -1) {
    throw new HttpError(404, 'Ingredient not found');
  }

  ingredients.splice(ingredientIndex, 1);
};

export const resetIngredientsForTest = (): void => {
  ingredients.length = 0;
};
