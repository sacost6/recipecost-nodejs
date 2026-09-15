import { Router } from 'express';
import { getUnitById, getUnits } from '../controllers/unit.controller';
import { validateRequest } from '../middleware/validateRequest.middleware';
import { unitParamsSchema } from '../schemas/unit.schema';

export const unitRoutes = Router();

unitRoutes.get('/', getUnits);

unitRoutes.get('/:unitId', validateRequest(unitParamsSchema), getUnitById);
