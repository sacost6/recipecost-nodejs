import type { Request, Response } from 'express';
import type { CreateProductPriceInput } from '../schemas/product_price.schema';
import type { IngredientProductParams } from '../schemas/ingredient_product.schema';
import { requireUserId } from './utils/auth';
import {
  createProductPriceService,
  getProductPricesByProductIdService,
} from '../services/product_price.service';

export const createProductPrice = async (
  req: Request<Record<string, never>, unknown, CreateProductPriceInput>,
  res: Response,
): Promise<void> => {
  const userId = requireUserId(req);

  const price = await createProductPriceService(userId, req.body);

  res.status(201).json({
    status: 'success',
    data: price,
  });
};

export const getProductPricesByProductId = async (
  req: Request<IngredientProductParams>,
  res: Response,
): Promise<void> => {
  const userId = requireUserId(req);

  const prices = await getProductPricesByProductIdService(
    userId,
    req.params.productId,
  );

  res.status(200).json({
    status: 'success',
    data: prices,
  });
};
