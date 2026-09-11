import { AppDataSource } from '../data-source';
import { StoreLocation } from '../entities/StoreLocation';

export const storeLocationRepository =
  AppDataSource.getRepository(StoreLocation);
