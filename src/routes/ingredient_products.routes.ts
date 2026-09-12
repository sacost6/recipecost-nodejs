import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest.middleware';
import { requireAuth } from '../middleware/requireAuth.middleware';
import {
  createIngredientProduct,
  deleteIngredientProduct,
  getIngredientProductById,
  getIngredientProductByUpc,
  getIngredientProducts,
  updateIngredientProduct,
} from '../controllers/ingredient_products.controller';
import {
  createIngredientProductSchema,
  ingredientProductParams,
  ingredientProductUpcParams,
  listIngredientProductSchema,
  updateIngredientProductSchema,
} from '../schemas/ingredient_product.schema';
import { deleteIngredient } from '../controllers/ingredients.controller';

export const ingredientProductRoutes = Router();

ingredientProductRoutes.get(
  '/',
  requireAuth,
  validateRequest(listIngredientProductSchema),
  getIngredientProducts,
);

ingredientProductRoutes.get(
  '/:upc',
  requireAuth,
  validateRequest(ingredientProductUpcParams),
  getIngredientProductByUpc,
);

ingredientProductRoutes.get(
  '/:productId',
  requireAuth,
  validateRequest(ingredientProductParams),
  getIngredientProductById,
);

ingredientProductRoutes.post(
  '/',
  requireAuth,
  validateRequest(createIngredientProductSchema),
  createIngredientProduct,
);

ingredientProductRoutes.patch(
  '/:productId',
  requireAuth,
  validateRequest(updateIngredientProductSchema),
  updateIngredientProduct,
);

ingredientProductRoutes.delete(
  '/:productId',
  requireAuth,
  validateRequest(ingredientProductParams),
  deleteIngredient,
);
