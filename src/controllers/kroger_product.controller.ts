import type { Request, Response } from 'express';
import type {
  KrogerProductLookupParams,
  KrogerProductLookupQuery,
} from '../schemas/kroger_product.schema';
import { getKrogerProduct } from '../services/kroger_service.client';

export const getKrogerProductByUpc = async (
  req: Request<KrogerProductLookupParams>,
  res: Response<unknown, { query: KrogerProductLookupQuery }>,
): Promise<void> => {
  const product = await getKrogerProduct(
    req.params.upc,
    res.locals.query.locationId,
  );
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ status: 'success', data: product });
};
