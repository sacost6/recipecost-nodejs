import { Router } from 'express';
import { getKrogerProductByUpc } from '../controllers/kroger_product.controller';
import { requireAuth } from '../middleware/requireAuth.middleware';
import { validateRequest } from '../middleware/validateRequest.middleware';
import { krogerProductLookupSchema } from '../schemas/kroger_product.schema';

export const krogerRoutes = Router();

krogerRoutes.get(
  '/products/:upc',
  requireAuth,
  validateRequest(krogerProductLookupSchema),
  getKrogerProductByUpc,
);
