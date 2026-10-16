import { validateRequest } from '../middleware/validateRequest.middleware';
import { requireAuth } from '../middleware/requireAuth.middleware';
import { Router } from 'express';
import {
  storeLocationParamsSchema,
  createStoreLocationSchema,
  updateStoreLocationSchema,
} from '../schemas/store_location.schema';
import {
  getStoreLocations,
  getStoreLocationById,
  createStoreLocation,
  updateStoreLocation,
} from '../controllers/store_location.controller';
import { getKrogerLocations } from '../controllers/kroger_location.controller';
import { krogerLocationSearchSchema } from '../schemas/kroger_location.schema';

export const storeLocationRoutes = Router();

storeLocationRoutes.get(
  '/kroger/search',
  requireAuth,
  validateRequest(krogerLocationSearchSchema),
  getKrogerLocations,
);

storeLocationRoutes.get('/', requireAuth, getStoreLocations);

storeLocationRoutes.get(
  '/:storeLocationId',
  requireAuth,
  validateRequest(storeLocationParamsSchema),
  getStoreLocationById,
);

storeLocationRoutes.post(
  '/',
  requireAuth,
  validateRequest(createStoreLocationSchema),
  createStoreLocation,
);

storeLocationRoutes.patch(
  '/:storeLocationId',
  requireAuth,
  validateRequest(updateStoreLocationSchema),
  updateStoreLocation,
);
