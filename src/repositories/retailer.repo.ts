import { AppDataSource } from '../data-source';
import { Retailer } from '../entities/Retailer';

export const retailerRepository = AppDataSource.getRepository(Retailer);
