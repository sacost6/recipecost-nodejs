import { ingredientRepository } from '../repositories/ingredient.repo';
import { Ingredient } from '../entities/Ingredient';
import { IsNull } from 'typeorm';
import {
  CreateIngredientInput,
  UpdateIngredientInput,
} from '../schemas/ingredient.schema';
import { HttpError } from '../middleware/errorHandling/error';

export type IngredientRow = {
  ingredient_id: string;
  category_id: number | null;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  version: number;
  user_id: string | null;
};

export const getIngredientsService = async (
  userId: string,
): Promise<Ingredient[]> => {
  const ingredient = await ingredientRepository.find({
    where: [{ userId: IsNull() }, { userId }],
    order: { name: 'ASC' },
  });

  if (!ingredient) {
    throw new HttpError(404, 'Ingredient not found.');
  }

  return ingredient;
};

export const getIngredientByIdService = async (
  userId: string,
  ingredientId: string,
): Promise<Ingredient> => {
  const ingredient = await ingredientRepository.findOneBy([
    { ingredientId, userId: IsNull() },
    { ingredientId, userId },
  ]);

  if (!ingredient) {
    throw new HttpError(404, 'Ingredient not found');
  }

  return ingredient;
};

export const createIngredientService = async (
  userId: string,
  input: CreateIngredientInput,
): Promise<Ingredient> => {
  const ingredient = ingredientRepository.create({
    userId,
    name: input.name,
    categoryId: input.categoryId ?? null,
    description: input.description ?? null,
  });

  return ingredientRepository.save(ingredient);
};

export const updateIngredientService = async (
  userId: string,
  ingredientId: string,
  input: UpdateIngredientInput,
): Promise<Ingredient> => {
  const { version: expectedVersion, ...changes } = input;

  const result = await ingredientRepository.update(
    { ingredientId, userId, version: expectedVersion },
    changes,
    { returning: '*' },
  );

  const [row] = result.raw as IngredientRow[];

  if (!row) {
    const exists = await ingredientRepository.existsBy({
      userId,
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
    userId: row.user_id,
  });
};

export const deleteIngredientService = async (
  userId: string,
  ingredientId: string,
): Promise<void> => {
  const result = await ingredientRepository.delete({
    ingredientId,
    userId,
  });

  if (result.affected === 0) {
    throw new HttpError(404, 'Ingredient not found');
  }
};
