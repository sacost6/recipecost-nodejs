import { ingredientRepository } from '../repositories/ingredient.repo';
import { ingredientCategoryRepository } from '../repositories/ingredient_category.repo';
import { Ingredient } from '../entities/Ingredient';
import { IsNull } from 'typeorm';
import { HttpError } from '../middleware/errorHandling/error';
import { requireUpdatedRow } from './utils/requireUpdatedRow';
import { entityFromRow } from './utils/entityFromRow';
import { IngredientRow } from './utils/databaseRowTypes';
import {
  CreateIngredientInput,
  UpdateIngredientInput,
} from '../schemas/ingredient.schema';

const withCategory = async (ingredient: Ingredient): Promise<Ingredient> => {
  ingredient.category =
    ingredient.categoryId === null
      ? null
      : await ingredientCategoryRepository.findOneBy({
          categoryId: ingredient.categoryId,
        });

  return ingredient;
};

const toTitleCase = (str: string) => {
  return str.toLocaleLowerCase().replace(/\b\w/g, function (char) {
    return char.toUpperCase();
  });
};

export const getIngredientsService = async (
  userId: string,
): Promise<Ingredient[]> => {
  const ingredient = await ingredientRepository.find({
    where: [{ userId: IsNull() }, { userId }],
    relations: {
      category: true,
    },
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
  const ingredient = await ingredientRepository.findOne({
    where: [
      { ingredientId, userId: IsNull() },
      { ingredientId, userId },
    ],
    relations: { category: true },
  });

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
    name: toTitleCase(input.name),
    categoryId: input.categoryId ?? null,
    description: input.description ?? null,
  });

  const savedIngredient = await ingredientRepository.save(ingredient);

  return withCategory(savedIngredient);
};

export const updateIngredientService = async (
  userId: string,
  ingredientId: string,
  input: UpdateIngredientInput,
): Promise<Ingredient> => {
  const { version: expectedVersion, ...changes } = input;

  await getIngredientByIdService(userId, ingredientId);

  const result = await ingredientRepository.update(
    { ingredientId, userId, version: expectedVersion },
    changes,
    { returning: '*' },
  );

  const row = await requireUpdatedRow(
    result.raw as IngredientRow[],
    () => ingredientRepository.existsBy({ ingredientId, userId }),
    'Ingredient',
  );

  const updatedIngredient = entityFromRow(ingredientRepository, row);

  return withCategory(updatedIngredient);
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
