import { retailerRepository } from '../repositories/retailer.repo';
import { Retailer } from '../entities/Retailer';
import { HttpError } from '../middleware/errorHandling/error';

export const getRetailerService = async (): Promise<Retailer[]> => {
  return retailerRepository.find({
    order: { name: 'ASC' },
  });
};

export const getRetailerByIdService = async (
  retailerId: string,
): Promise<Retailer> => {
  const retailer = await retailerRepository.findOneBy({
    retailerId,
  });

  if (!retailer) {
    throw new HttpError(404, 'Unit does not exist.');
  }

  return retailer;
};
