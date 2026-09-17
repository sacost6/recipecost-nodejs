import { storeLocationRepository } from '../repositories/store_location.repo';
import { StoreLocation } from '../entities/StoreLocation';
import { CreateStoreLocationInput } from '../schemas/store_location.schema';
import { HttpError } from '../middleware/errorHandling/error';

export const getStoreLocationsService = async (): Promise<StoreLocation[]> => {
  return storeLocationRepository.find({
    order: { retailerId: 'ASC' },
  });
};

export const getStoreLocationByIdService = async (
  storeLocationId: string,
): Promise<StoreLocation> => {
  const location = await storeLocationRepository.findOneBy({
    storeLocationId,
  });

  if (!location) {
    throw new HttpError(404, 'Store location does not exist.');
  }

  return location;
};

export const createStoreLocationService = async (
  input: CreateStoreLocationInput,
): Promise<StoreLocation> => {
  const storeLocation = storeLocationRepository.create({
    retailerId: input.retailerId,
    storeNumber: input.storeNumber,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    stateCode: input.stateCode,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
  });

  return storeLocationRepository.save(storeLocation);
};
