import { AppDataSource } from '../data-source';
import { Ingredient } from '../entities/Ingredient';
import {
  CreateIngredientInput,
  UpdateIngredientInput,
} from '../schemas/ingredient.schema';
import { HttpError } from '../utils/httpError';

const ingredientRepository = AppDataSource.getRepository(Ingredient);

export const getIngredientsService = async (): Promise<Ingredient[]> => {
  return ingredientRepository.find({
    order: { name: 'ASC' },
  });
};

export const getIngredientByIdService = async (
  ingredientId: string,
): Promise<Ingredient> => {
  const ingredient = await ingredientRepository.findOneBy({
    ingredientId,
  });

  if (!ingredient) {
    throw new HttpError(404, 'Ingredient not found');
  }

  return ingredient;
};

export const createIngredientService = async (
  input: CreateIngredientInput,
): Promise<Ingredient> => {
  const ingredient = ingredientRepository.create({
    name: input.name,
    categoryId: input.categoryId ?? null,
    description: input.description ?? null,
  });

  return ingredientRepository.save(ingredient);
};

export const updateIngredientService = async (
  ingredientId: string,
  input: UpdateIngredientInput,
): Promise<Ingredient> => {
  const ingredient = await getIngredientByIdService(ingredientId);

  ingredientRepository.merge(ingredient, input);

  return ingredientRepository.save(ingredient);
};

export const deleteIngredientService = async (
  ingredientId: string,
): Promise<void> => {
  const result = await ingredientRepository.delete({ ingredientId });

  if (result.affected === 0) {
    throw new HttpError(404, 'Ingredient not found');
  }
};