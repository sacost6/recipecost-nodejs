import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.middleware';
import { validateRequest } from '../middleware/validateRequest.middleware';
import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  getRecipes,
  updateRecipe,
} from '../controllers/recipe.controller';
import {
  createRecipeIngredient,
  deleteRecipeIngredient,
  getRecipeIngredients,
  updateRecipeIngredient,
} from '../controllers/recipe_ingredient.controller';
import {
  createRecipeSchema,
  recipeParamsSchema,
  updateRecipeSchema,
} from '../schemas/recipe.schema';
import {
  createRecipeIngredientSchema,
  deleteRecipeIngredientSchema,
  updateRecipeIngredientSchema,
} from '../schemas/recipe_ingredient.schema';

export const recipeRoutes = Router();

recipeRoutes.use(requireAuth);

recipeRoutes.get('/', getRecipes);
recipeRoutes.post('/', validateRequest(createRecipeSchema), createRecipe);
recipeRoutes.get(
  '/:recipeId',
  validateRequest(recipeParamsSchema),
  getRecipeById,
);
recipeRoutes.patch(
  '/:recipeId',
  validateRequest(updateRecipeSchema),
  updateRecipe,
);
recipeRoutes.delete(
  '/:recipeId',
  validateRequest(recipeParamsSchema),
  deleteRecipe,
);

recipeRoutes.get(
  '/:recipeId/ingredients',
  validateRequest(recipeParamsSchema),
  getRecipeIngredients,
);
recipeRoutes.post(
  '/:recipeId/ingredients',
  validateRequest(createRecipeIngredientSchema),
  createRecipeIngredient,
);
recipeRoutes.patch(
  '/:recipeId/ingredients/:recipeIngredientId',
  validateRequest(updateRecipeIngredientSchema),
  updateRecipeIngredient,
);
recipeRoutes.delete(
  '/:recipeId/ingredients/:recipeIngredientId',
  validateRequest(deleteRecipeIngredientSchema),
  deleteRecipeIngredient,
);
