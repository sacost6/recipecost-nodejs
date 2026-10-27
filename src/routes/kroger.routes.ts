import { Router } from 'express';
import {
  getKrogerProductByUpc,
  searchKrogerProductsForTerm,
} from '../controllers/kroger_product.controller';
import { requireAuth } from '../middleware/requireAuth.middleware';
import { validateRequest } from '../middleware/validateRequest.middleware';
import {
  krogerProductLookupSchema,
  krogerProductSearchSchema,
} from '../schemas/kroger_product.schema';

export const krogerRoutes = Router();

krogerRoutes.get(
  '/products/search',
  requireAuth,
  validateRequest(krogerProductSearchSchema),
  searchKrogerProductsForTerm,
);

krogerRoutes.get(
  '/products/:upc',
  requireAuth,
  validateRequest(krogerProductLookupSchema),
  getKrogerProductByUpc,
);
