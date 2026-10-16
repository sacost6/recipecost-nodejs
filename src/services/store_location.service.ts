import { storeLocationRepository } from '../repositories/store_location.repo';
import { StoreLocation } from '../entities/StoreLocation';
import {
  CreateStoreLocationInput,
  UpdateStoreLocationInput,
} from '../schemas/store_location.schema';
import { HttpError } from '../middleware/errorHandling/error';

export const getStoreLocationsService = async (): Promise<StoreLocation[]> => {
  return storeLocationRepository.find({
    relations: { retailer: true },
    order: { retailerId: 'ASC' },
  });
};

export const getStoreLocationByIdService = async (
  storeLocationId: string,
): Promise<StoreLocation> => {
  const location = await storeLocationRepository.findOne({
    where: { storeLocationId },
    relations: { retailer: true },
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
    storeNumber: input.storeNumber ?? null,
    addressLine1: input.streetName,
    addressLine2: input.addressLine2 ?? null,
    city: input.city,
    stateCode: input.stateCode ?? null,
    postalCode: input.postalCode ?? null,
    countryCode: input.countryCode,
    krogerLocationId: input.krogerLocationId ?? null,
  });

  const savedLocation = await storeLocationRepository.save(storeLocation);
  const locationWithRetailer = await storeLocationRepository.findOne({
    where: { storeLocationId: savedLocation.storeLocationId },
    relations: { retailer: true },
  });

  if (!locationWithRetailer) {
    throw new HttpError(500, 'Unable to load the created store location.');
  }

  return locationWithRetailer;
};

export const updateStoreLocationService = async (
  storeLocationId: string,
  input: UpdateStoreLocationInput,
): Promise<StoreLocation> => {
  const location = await storeLocationRepository.findOneBy({ storeLocationId });
  if (!location) throw new HttpError(404, 'Store location does not exist.');
  storeLocationRepository.merge(location, {
    retailerId: input.retailerId,
    storeNumber: input.storeNumber,
    addressLine1: input.streetName,
    addressLine2: input.addressLine2,
    stateCode: input.stateCode,
    city: input.city,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
    krogerLocationId: input.krogerLocationId,
  });
  return storeLocationRepository.save(location);
};
