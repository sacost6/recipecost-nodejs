import type { Request, Response } from 'express';
import {
  getStoreLocationsService,
  getStoreLocationByIdService,
  createStoreLocationService,
  updateStoreLocationService,
} from '../services/store_location.service';
import {
  StoreLocationParamsSchema,
  CreateStoreLocationInput,
  UpdateStoreLocationInput,
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
    status: 'success',
    data: location,
  });
};

export const updateStoreLocation = async (
  req: Request<StoreLocationParamsSchema, unknown, UpdateStoreLocationInput>,
  res: Response,
) => {
  const location = await updateStoreLocationService(
    req.params.storeLocationId,
    req.body,
  );
  res.status(200).json({ status: 'success', data: location });
};
