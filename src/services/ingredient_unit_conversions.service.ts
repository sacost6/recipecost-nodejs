import { ingredientUnitConversionRepository } from '../repositories/ingredient_unit_conversion.repo';
import { IngredientUnitConversion } from '../entities/IngredientUnitConversion';
import {
  CreateIngredientUnitConversionInput,
  UpdateIngredientUnitConversionInput,
} from '../schemas/ingredient_unit_conversion.schema';
import { HttpError } from '../middleware/errorHandling/ error';

export const getIngredientUnitConversionsService = async (): Promise<
  IngredientUnitConversion[]
> => {
  return ingredientUnitConversionRepository.find({
    order: { ingredientId: 'ASC' },
  });
};

export const getIngredientUnitConversionByIngredientIdService = async (
  ingredientId: string,
): Promise<IngredientUnitConversion> => {
  const ingredientUnitConversion =
    await ingredientUnitConversionRepository.findOneBy({
      ingredientId,
    });

  if (!ingredientUnitConversion) {
    throw new HttpError(
      404,
      'Unit conversion does not exist for this ingredient.',
    );
  }

  return ingredientUnitConversion;
};

export const createIngredientUnitConverionService = async (
  input: CreateIngredientUnitConversionInput,
): Promise<IngredientUnitConversion> => {
  const ingredientUnitConversion = ingredientUnitConversionRepository.create({
    ingredientId: input.ingredientId,
    fromUnitId: input.fromUnitId,
    toUnitId: input.toUnitId,
    conversionFactor: input.conversionFactor,
  });

  return ingredientUnitConversionRepository.save(ingredientUnitConversion);
};

export const updateIngredientUnitConversionService = async (
  ingredientId: string,
  input: UpdateIngredientUnitConversionInput,
): Promise<IngredientUnitConversion> => {
  const ingredientUnitConversion =
    await getIngredientUnitConversionByIngredientIdService(ingredientId);

  ingredientUnitConversionRepository.merge(ingredientUnitConversion, input);

  return ingredientUnitConversionRepository.save(ingredientUnitConversion);
};

export const deleteIngredientUnitConversionService = async (
  ingredientId: string,
): Promise<void> => {
  const result = await ingredientUnitConversionRepository.delete({
    ingredientId,
  });

  if (result.affected === 0) {
    throw new HttpError(
      404,
      'Unit conversion does not exist for this ingredient.',
    );
  }
};
