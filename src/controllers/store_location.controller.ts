import type { Request, Response } from 'express';
import {
  getStoreLocationsService,
  getStoreLocationByIdService,
  createStoreLocationService,
} from '../services/store_locations.service';
import {
  StoreLocationParamsSchema,
  CreateStoreLocationInput,
} from '../schemas/store_location.schema';

export const getStoreLocations = async (req: Request, res: Response) => {
  const locations = await getStoreLocationsService();

  res.status(200).json({
    status: 'success',
    data: locations,
  });
};

export const getStoreLocationById = async (
  req: Request<StoreLocationParamsSchema>,
  res: Response,
) => {
  const { storeLocationId } = req.params;

  const location = await getStoreLocationByIdService(storeLocationId);

  res.status(200).json({
    status: 'success',
    data: location,
  });
};

export const createStoreLocation = async (
  req: Request<Record<string, never>, unknown, CreateStoreLocationInput>,
  res: Response,
) => {
  const location = await createStoreLocationService(req.body);

  res.status(201).json({
    status: 'succss',
    data: location,
  });
};
