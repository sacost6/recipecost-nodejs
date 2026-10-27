import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.middleware';
import { validateRequest } from '../middleware/validateRequest.middleware';
import {
  createIngredient,
  deleteIngredient,
  getIngredientsById,
  getIngredients,
  updateIngredient,
} from '../controllers/ingredient.controller';
import {
  deleteIngredientDensity,
  getIngredientDensity,
  getIngredientDensitySuggestions,
  saveIngredientDensity,
  searchIngredientDensityFoods,
} from '../controllers/ingredient_density.controller';
import {
  createIngredientSchema,
  updateIngredientSchema,
  ingredientParamsSchema,
} from '../schemas/ingredient.schema';
import {
  ingredientDensityParamsSchema,
  ingredientDensitySuggestionsSchema,
  saveIngredientDensitySchema,
  searchIngredientDensityFoodsSchema,
} from '../schemas/ingredient_density.schema';

export const ingredientRoutes = Router();

ingredientRoutes.use(requireAuth);

ingredientRoutes.get('/', getIngredients);

ingredientRoutes.get(
  '/:ingredientId/density',
  validateRequest(ingredientDensityParamsSchema),
  getIngredientDensity,
);
ingredientRoutes.post(
  '/:ingredientId/density/usda/search',
  validateRequest(searchIngredientDensityFoodsSchema),
  searchIngredientDensityFoods,
);
ingredientRoutes.get(
  '/:ingredientId/density/usda/:fdcId/suggestions',
  validateRequest(ingredientDensitySuggestionsSchema),
  getIngredientDensitySuggestions,
);
ingredientRoutes.put(
  '/:ingredientId/density',
  validateRequest(saveIngredientDensitySchema),
  saveIngredientDensity,
);
ingredientRoutes.delete(
  '/:ingredientId/density',
  validateRequest(ingredientDensityParamsSchema),
  deleteIngredientDensity,
);

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
