import { Router } from 'express';

import {
  createIngredient,
  deleteIngredient,
  getIngredientsById,
  getIngredients,
  updateIngredient,
} from '../controllers/ingredients.controller';

import { validateRequest } from '../middleware/validateRequest.middleware';

import {
  createIngredientSchema,
  updateIngredientSchema,
  ingredientParamsSchema,
} from '../schemas/ingredient.schema';

export const ingredientRoutes = Router();

ingredientRoutes.get('/', getIngredients);

ingredientRoutes.post(
  '/',
  validateRequest(createIngredientSchema),
  createIngredient,
);

ingredientRoutes.get(
  '/:ingredientId',
  validateRequest(ingredientParamsSchema),
  getIngredientsById,
);

ingredientRoutes.patch(
  '/:ingredientId',
  validateRequest(updateIngredientSchema),
  updateIngredient,
);

ingredientRoutes.delete(
  '/:ingredientId',
  validateRequest(ingredientParamsSchema),
  deleteIngredient,
);
