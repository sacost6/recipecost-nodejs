import type { Request, Response } from 'express';
import {
  getIngredientUnitConversionsService,
  getIngredientUnitConversionByIngredientIdService,
  getIngredientUnitConversionByIdService,
} from '../services/ingredient_unit_conversion.service';
import {
  IngredientUnitConversionByIngredientIdParamsSchema,
  IngredientUnitConversionByIdParamsSchema,
} from '../schemas/ingredient_unit_conversion.schema';
import { HttpError } from '../middleware/errorHandling/error';

export const getIngredientUnitConversions = async (
  req: Request,
  res: Response,
) => {
  const ingredientUnitConversions = await getIngredientUnitConversionsService();

  res.status(200).json({
    status: 'success',
    data: ingredientUnitConversions,
  });
};

export const getIngredientUnitConversionByIngredientId = async (
  req: Request<IngredientUnitConversionByIngredientIdParamsSchema>,
  res: Response,
) => {
  const { ingredientId } = req.params;

  const ingredientUnitConversion =
    await getIngredientUnitConversionByIngredientIdService(ingredientId);

  res.status(200).json({
    status: 'success',
    data: ingredientUnitConversion,
  });
};

export const getIngredientUnitConversionById = async (
  req: Request<IngredientUnitConversionByIdParamsSchema>,
  res: Response,
) => {
  const { ingredientId, fromUnitId, toUnitId } = req.params;

  const ingredientUnitConversion = await getIngredientUnitConversionByIdService(
    ingredientId,
    fromUnitId,
    toUnitId,
  );

  if (!ingredientUnitConversion) {
    throw new HttpError(
      404,
      'Unit conversion does not exist for this ingredient.',
    );
  }
};
