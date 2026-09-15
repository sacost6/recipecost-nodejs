import { Router } from 'express';
import {
  getIngredientCategoryById,
  getIngredientCategories,
} from '../controllers/ingredient_category.controller';
import { validateRequest } from '../middleware/validateRequest.middleware';
import { ingredientCategoryParamsSchema } from '../schemas/ingredient_category.schema';

export const ingredientCategoryRoutes = Router();

ingredientCategoryParamsSchema.get('/', getIngredientCategories);
