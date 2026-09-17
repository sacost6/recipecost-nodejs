import type { Request, Response } from 'express';
import { getUnitService, getUnitByIdService } from '../services/unit.service';
import type { UnitParamsSchema } from '../schemas/unit.schema';

export const getUnits = async (req: Request, res: Response) => {
  const units = await getUnitService();

  res.status(200).json({
    status: 'success',
    data: units,
  });
};

export const getUnitById = async (
  req: Request<UnitParamsSchema>,
  res: Response,
) => {
  const { unitId } = req.params;

  const unit = await getUnitByIdService(Number(unitId));

  res.status(200).json({
    status: 'success',
    data: unit,
  });
};
