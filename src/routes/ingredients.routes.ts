import { Router } from 'express';

import {
  createIngredient,
  deleteIngredient,
  getIngredientsById,
  getIngredients,
  updateIngredient,
} from '../controllers/ingredients.controller';

//import { validateRequest } from '../middleware/validateRequest.middleware';

//import {
// createIngredientsSchema,
// updateIngredientsSchema,
// ingredientParamsSchema,
// } from '../schemas/ingredients.schema';

export const ingredientRoutes = Router();

ingredientRoutes.get('/', getIngredients);

ingredientRoutes.post(
  '/',
  // validateRequest(createIngredientsSchema),
  createIngredient,
);

ingredientRoutes.get(
  '/:ingredientId',
  // validateRequest(ingredientParamsSchema),
  getIngredientsById,
);

ingredientRoutes.patch(
  '/:ingredientId',
  // validateRequest(ingredientParamsSchema),
  // validateRequest(updateIngredientSchema),
  updateIngredient,
);

ingredientRoutes.delete(
  '/:ingredientId',
  // validateRequest(ingredientParamsSchema),
  deleteIngredient,
);
