import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.middleware';
import { validateRequest } from '../middleware/validateRequest.middleware';
import {
  createIngredient,
  deleteIngredient,
  getIngredientsById,
  getIngredients,
  updateIngredient,
} from '../controllers/ingredients.controller';
import {
  createIngredientSchema,
  updateIngredientSchema,
  ingredientParamsSchema,
} from '../schemas/ingredient.schema';

export const ingredientRoutes = Router();

ingredientRoutes.use(requireAuth);

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
