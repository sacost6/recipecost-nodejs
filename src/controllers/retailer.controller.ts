import type { Request, Response } from 'express';
import {
  getRetailerService,
  getRetailerByIdService,
} from '../services/retailer.service';
import type { RetailerParamsSchema } from '../schemas/retailer.schema';

export const getRetailers = async (req: Request, res: Response) => {
  const retailers = await getRetailerService();

  res.status(200).json({
    status: 'success',
    data: retailers,
  });
};

export const getRetailerById = async (
  req: Request<RetailerParamsSchema>,
  res: Response,
) => {
  const { retailerId } = req.params;

  const retailer = await getRetailerByIdService(retailerId);

  res.status(200).json({
    status: 'success',
    data: retailer,
  });
};
