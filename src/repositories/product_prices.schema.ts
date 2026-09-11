import { AppDataSource } from '../data-source';
import { ProductPrice } from '../entities/ProductPrice';

export const productPriceRepository = AppDataSource.getRepository(ProductPrice);
