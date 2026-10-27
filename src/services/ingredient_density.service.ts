import { ingredientDensityRepository } from '../repositories/ingredient_density.repo';
import { getIngredientByIdService } from './ingredient.service';
import {
  searchUsdaFoods,
  getUsdaDensitySuggestions,
} from './pricing_service.client';
import { HttpError } from '../middleware/errorHandling/error';
import type {
  SaveIngredientDensityInput,
  SearchIngredientDensityFoodsInput,
} from '../schemas/ingredient_density.schema';

export const getIngredientDensityService = async (
  userId: string,
  ingredientId: string,
) => {
  await getIngredientByIdService(userId, ingredientId);
  return ingredientDensityRepository.findOneBy({ userId, ingredientId });
};

export const searchIngredientDensityFoodsService = async (
  userId: string,
  ingredientId: string,
  input: SearchIngredientDensityFoodsInput,
) => {
  const ingredient = await getIngredientByIdService(userId, ingredientId);
  return searchUsdaFoods(input.query?.trim() || ingredient.name);
};

export const getIngredientDensitySuggestionsService = async (
  userId: string,
  ingredientId: string,
  fdcId: number,
) => {
  await getIngredientByIdService(userId, ingredientId);
  return getUsdaDensitySuggestions(fdcId);
};

export const saveIngredientDensityService = async (
  userId: string,
  ingredientId: string,
  input: SaveIngredientDensityInput,
) => {
  await getIngredientByIdService(userId, ingredientId);
  const suggestions = await getUsdaDensitySuggestions(input.fdcId);
  const selected = suggestions.find(
    (item) => item.portionId === input.portionId,
  );
  if (!selected) {
    throw new HttpError(
      422,
      'That USDA portion is not a supported volume measure.',
    );
  }

  const existing = await ingredientDensityRepository.findOneBy({
    userId,
    ingredientId,
  });
  const density = ingredientDensityRepository.create({
    ...(existing ? { densityId: existing.densityId } : {}),
    ingredientId,
    userId,
    densityGramsPerMl: selected.densityGramsPerMl,
    fdcId: selected.fdcId,
    dataType: selected.dataType,
    foodDescription: selected.foodDescription,
    portionId: selected.portionId,
    portionAmount: selected.portionAmount,
    portionDescription: selected.portionDescription,
    measureUnit: selected.measureUnit,
    gramWeight: selected.gramWeight,
    confirmedAt: new Date(),
  });

  return ingredientDensityRepository.save(density);
};

export const deleteIngredientDensityService = async (
  userId: string,
  ingredientId: string,
): Promise<void> => {
  await getIngredientByIdService(userId, ingredientId);
  const result = await ingredientDensityRepository.delete({
    userId,
    ingredientId,
  });
  if (result.affected === 0) {
    throw new HttpError(
      404,
      'No confirmed density exists for this ingredient.',
    );
  }
};
