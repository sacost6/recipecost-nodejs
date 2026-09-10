import {
  ingredientRepository,
  type IngredientRow,
} from '../repositories/ingredient.repo';
import { Ingredient } from '../entities/Ingredient';
import {
  CreateIngredientInput,
  UpdateIngredientInput,
} from '../schemas/ingredient.schema';
import { HttpError } from '../utils/httpError';

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
  const result = await ingredientRepository.update({ ingredientId }, input, {
    returning: '*',
  });

  const [row] = result.raw as IngredientRow[];

  if (!row) {
    throw new HttpError(404, 'Ingredient not found');
  }

  return ingredientRepository.create({
    ingredientId: row.ingredient_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

export const deleteIngredientService = async (
  ingredientId: string,
): Promise<void> => {
  const result = await ingredientRepository.delete({ ingredientId });

  if (result.affected === 0) {
    throw new HttpError(404, 'Ingredient not found');
  }
};
