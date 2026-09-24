import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.middleware';
import { validateRequest } from '../middleware/validateRequest.middleware';
import { createProductPriceSchema } from '../schemas/product_price.schema';
import { createProductPrice } from '../controllers/product_price.controller';

export const productPriceRoutes = Router();

productPriceRoutes.use(requireAuth);

productPriceRoutes.post(
  '/',
  validateRequest(createProductPriceSchema),
  createProductPrice,
);
