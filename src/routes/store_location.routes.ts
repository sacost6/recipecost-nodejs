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
import { validate } from 'zod';

export const storeLocationRoutes = Router();

storeLocationRoutes.get('/', getStoreLocations);

storeLocationRoutes.get(
  '/:locationId',
  validateRequest(storeLocationParamsSchema),
  getStoreLocationById,
);

storeLocationRoutes.post(
  '/',
  validateRequest(createStoreLocationSchema),
  createStoreLocation,
);
