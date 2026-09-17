import { validateRequest } from '../middleware/validateRequest.middleware';
import { requireAuth } from '../middleware/requireAuth.middleware';
import { Router } from 'express';
import {
  getStoreLocations,
  getStoreLocationById,
  createStoreLocation,
} from '../controllers/store_location.controller';
import {
  storeLocationParamsSchema,
  createStoreLocationSchema,
} from '../schemas/store_location.schema';

export const storeLocationRoutes = Router();

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
