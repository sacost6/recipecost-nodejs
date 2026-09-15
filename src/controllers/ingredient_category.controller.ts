import type { Request, Response } from 'express';
import {
  getIngredientCategoriesService,
  getIngredientCategoryByIdService,
} from '../services/ingredient_category.service';
import type { IngredientCategoryParamsSchema } from '../schemas/ingredient_category.schema';

export const getIngredientCategories = async (req: Request, res: Response) => {
  const categories = await getIngredientCategoriesService();

  res.status(200).json({
    status: 'success',
    data: categories,
  });
};

export const getIngredientCategoryById = async (
  req: Request<IngredientCategoryParamsSchema>,
  res: Response,
) => {
  const { categoryId } = req.params;

  const category = await getIngredientCategoryByIdService(Number(categoryId));

  res.status(200).json({
    status: 'success',
    data: category,
  });
};
