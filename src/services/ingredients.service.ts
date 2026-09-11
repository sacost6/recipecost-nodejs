import { ingredientRepository } from '../repositories/ingredient.repo';
import { Ingredient } from '../entities/Ingredient';
import {
  CreateIngredientInput,
  UpdateIngredientInput,
} from '../schemas/ingredient.schema';
import { HttpError } from '../middleware/errorHandling/ error';

export type IngredientRow = {
  ingredient_id: string;
  category_id: number | null;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

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
  const { version: expectedVersion, ...changes } = input;

  const result = await ingredientRepository.update(
    { ingredientId, version: expectedVersion },
    changes,
    { returning: '*' },
  );

  const [row] = result.raw as IngredientRow[];

  if (!row) {
    const exists = await ingredientRepository.existsBy({
      ingredientId,
    });

    if (!exists) {
      throw new HttpError(404, 'Ingredient not found');
    }

    throw new HttpError(
      409,
      'This ingredient has changed. Reload it before saving again.',
    );
  }

  return ingredientRepository.create({
    ingredientId: row.ingredient_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
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
