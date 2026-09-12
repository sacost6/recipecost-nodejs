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

export const ingredientProductRoutes = Router();

ingredientProductRoutes.use(requireAuth);

ingredientProductRoutes.get(
  '/',

  validateRequest(listIngredientProductSchema),
  getIngredientProducts,
);

ingredientProductRoutes.get(
  '/upc/:upc',
  validateRequest(ingredientProductUpcParams),
  getIngredientProductByUpc,
);

ingredientProductRoutes.get(
  '/:productId',
  validateRequest(ingredientProductParams),
  getIngredientProductById,
);

ingredientProductRoutes.post(
  '/',
  validateRequest(createIngredientProductSchema),
  createIngredientProduct,
);

ingredientProductRoutes.patch(
  '/:productId',
  validateRequest(updateIngredientProductSchema),
  updateIngredientProduct,
);

ingredientProductRoutes.delete(
  '/:productId',
  validateRequest(ingredientProductParams),
  deleteIngredientProduct,
);
