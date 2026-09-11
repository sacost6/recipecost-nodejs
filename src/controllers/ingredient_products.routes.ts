import { type Request, type Response } from 'express';
import type {
  IngredientProductParamsSchema,
  ListIngredientProductsQuery,
} from '../schemas/ingredient_product.schema';
import {
  getIngredientProductsService,
  getIngredientProductByIdService,
  getIngredientProductByUpc,
  createIngredientProductService,
  updateIngredientProductService,
  deleteIngredientProductService,
} from '../services/ingredient_products.service';
import { HttpError } from '../middleware/errorHandling/ error';

export const getIngredientProducts = async (
  req: Request,
  res: Response<unknown, { query: ListIngredientProductsQuery }>,
): Promise<void> => {
  const userId = req.session.userId;

  if (!userId) {
    throw new HttpError(
      404,
      'No user profile available to pull products from.',
    );
  }

  const products = await getIngredientProductsService(userId, res.locals.query);

  res.status(200).json({
    status: 'success',
    data: 'products',
  });
};
