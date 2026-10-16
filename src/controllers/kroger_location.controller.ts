import type { Request, Response } from 'express';
import type { KrogerLocationSearchQuery } from '../schemas/kroger_location.schema';
import { searchKrogerLocations } from '../services/kroger_location.service';

export const getKrogerLocations = async (
  _req: Request,
  res: Response<unknown, { query: KrogerLocationSearchQuery }>,
) => {
  const locations = await searchKrogerLocations(res.locals.query);
  res.status(200).json({ status: 'success', data: locations });
};
