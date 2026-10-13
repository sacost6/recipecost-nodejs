import { Router } from 'express';
import {
  createIngredientUnitConversion,
  deleteIngredientUnitConversion,
  getIngredientUnitConversionByIngredientId,
  getIngredientUnitConversionById,
  getIngredientUnitConversions,
  updateIngredientUnitConversion,
} from '../controllers/ingredient_unit_conversion.controller';
import { requireAuth } from '../middleware/requireAuth.middleware';
import { validateRequest } from '../middleware/validateRequest.middleware';
import {
  createIngredientUnitConversionSchema,
  ingredientUnitConversionByIdParamsSchema,
  ingredientUnitConversionByIngredientIdParamsSchema,
  updateIngredientUnitConversionSchema,
} from '../schemas/ingredient_unit_conversion.schema';

export const ingredientUnitConversionRoutes = Router();

ingredientUnitConversionRoutes.use(requireAuth);
ingredientUnitConversionRoutes.get('/', getIngredientUnitConversions);
ingredientUnitConversionRoutes.post(
  '/',
  validateRequest(createIngredientUnitConversionSchema),
  createIngredientUnitConversion,
);
ingredientUnitConversionRoutes.get(
  '/:ingredientId',
  validateRequest(ingredientUnitConversionByIngredientIdParamsSchema),
  getIngredientUnitConversionByIngredientId,
);
ingredientUnitConversionRoutes.get(
  '/:ingredientId/:fromUnitId/:toUnitId',
  validateRequest(ingredientUnitConversionByIdParamsSchema),
  getIngredientUnitConversionById,
);
ingredientUnitConversionRoutes.patch(
  '/:ingredientId/:fromUnitId/:toUnitId',
  validateRequest(updateIngredientUnitConversionSchema),
  updateIngredientUnitConversion,
);
ingredientUnitConversionRoutes.delete(
  '/:ingredientId/:fromUnitId/:toUnitId',
  validateRequest(ingredientUnitConversionByIdParamsSchema),
  deleteIngredientUnitConversion,
);
