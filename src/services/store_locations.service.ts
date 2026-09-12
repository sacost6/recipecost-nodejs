import { storeLocationRepository } from '../repositories/store_locations.repo';
import { StoreLocation } from '../entities/StoreLocation';
import { CreateStoreLocationInput } from '../schemas/store_locations.schema';

export const getStoreLocationsService = async (): Promise<StoreLocation[]> => {
  return storeLocationRepository.find({
    order: { retailerId: 'ASC' },
  });
};

export const getStoreLocationService = async (
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
