import { IsNull } from 'typeorm';
import { ingredientUnitConversionRepository } from '../repositories/ingredient_unit_conversion.repo';
import { IngredientUnitConversion } from '../entities/IngredientUnitConversion';
import {
  CreateIngredientUnitConversionInput,
  UpdateIngredientUnitConversionInput,
} from '../schemas/ingredient_unit_conversion.schema';
import { HttpError } from '../middleware/errorHandling/error';
import { getIngredientByIdService } from './ingredient.service';

const assertCanManageIngredientConversions = async (
  userId: string,
  ingredientId: string,
): Promise<void> => {
  const ingredient = await getIngredientByIdService(userId, ingredientId);

  if (ingredient.userId !== userId) {
    throw new HttpError(
      403,
      'Conversions for shared ingredients cannot be changed.',
    );
  }
};

export const getIngredientUnitConversionsService = async (
  userId: string,
): Promise<IngredientUnitConversion[]> => {
  return ingredientUnitConversionRepository.find({
    where: [{ ingredient: { userId: IsNull() } }, { ingredient: { userId } }],
    order: {
      ingredientId: 'ASC',
      fromUnitId: 'ASC',
      toUnitId: 'ASC',
    },
  });
};

export const getIngredientUnitConversionByIngredientIdService = async (
  userId: string,
  ingredientId: string,
): Promise<IngredientUnitConversion[]> => {
  await getIngredientByIdService(userId, ingredientId);

  return ingredientUnitConversionRepository.find({
    where: { ingredientId },
    order: { fromUnitId: 'ASC', toUnitId: 'ASC' },
  });
};

export const getIngredientUnitConversionByIdService = async (
  userId: string,
  ingredientId: string,
  fromUnitId: number,
  toUnitId: number,
): Promise<IngredientUnitConversion> => {
  await getIngredientByIdService(userId, ingredientId);

  const ingredientUnitConversion =
    await ingredientUnitConversionRepository.findOneBy({
      ingredientId,
      fromUnitId,
      toUnitId,
    });

  if (!ingredientUnitConversion) {
    throw new HttpError(
      404,
      'No matching unit conversion exists for this ingredient.',
    );
  }

  return ingredientUnitConversion;
};

export const createIngredientUnitConversionService = async (
  userId: string,
  input: CreateIngredientUnitConversionInput,
): Promise<IngredientUnitConversion> => {
  await assertCanManageIngredientConversions(userId, input.ingredientId);

  const ingredientUnitConversion = ingredientUnitConversionRepository.create({
    ingredientId: input.ingredientId,
    fromUnitId: input.fromUnitId,
    toUnitId: input.toUnitId,
    conversionFactor: input.conversionFactor,
  });

  return ingredientUnitConversionRepository.save(ingredientUnitConversion);
};

export const updateIngredientUnitConversionService = async (
  userId: string,
  ingredientId: string,
  fromUnitId: number,
  toUnitId: number,
  input: UpdateIngredientUnitConversionInput,
): Promise<IngredientUnitConversion> => {
  await assertCanManageIngredientConversions(userId, ingredientId);

  const ingredientUnitConversion =
    await ingredientUnitConversionRepository.findOneBy({
      ingredientId,
      fromUnitId,
      toUnitId,
    });

  if (!ingredientUnitConversion) {
    throw new HttpError(
      404,
      'No matching unit conversion exists for this ingredient.',
    );
  }

  ingredientUnitConversionRepository.merge(ingredientUnitConversion, input);

  return ingredientUnitConversionRepository.save(ingredientUnitConversion);
};

export const deleteIngredientUnitConversionService = async (
  userId: string,
  ingredientId: string,
  fromUnitId: number,
  toUnitId: number,
): Promise<void> => {
  await assertCanManageIngredientConversions(userId, ingredientId);

  const result = await ingredientUnitConversionRepository.delete({
    ingredientId,
    fromUnitId,
    toUnitId,
  });

  if (result.affected === 0) {
    throw new HttpError(
      404,
      'No matching unit conversion exists for this ingredient.',
    );
  }
};
