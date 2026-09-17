import { Router } from 'express';
import {
  getStoreLocations,
  getStoreLocationById,
  createStoreLocation,
} from '../controllers/store_location.controller';
import { validateRequest } from '../middleware/validateRequest.middleware';
import {
  storeLocationParamsSchema,
  createStoreLocationSchema,
} from '../schemas/store_location.schema';

export const storeLocationRoutes = Router();

storeLocationRoutes.get('/', getStoreLocations);

storeLocationRoutes.get(
  '/:storeLocationId',
  validateRequest(storeLocationParamsSchema),
  getStoreLocationById,
);

storeLocationRoutes.post(
  '/',
  validateRequest(createStoreLocationSchema),
  createStoreLocation,
);
