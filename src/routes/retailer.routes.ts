import { Router } from 'express';
import {
  getRetailers,
  getRetailerById,
} from '../controllers/retailer.controller';
import { retailerParamsSchema } from '../schemas/retailer.schema';
import { validateRequest } from '../middleware/validateRequest.middleware';
import { requireAuth } from '../middleware/requireAuth.middleware';
export const retailerRoutes = Router();

retailerRoutes.get('/', getRetailers);

retailerRoutes.get(
  '/:retailerId',
  validateRequest(retailerParamsSchema),
  getRetailerById,
);
