import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { env } from './schemas/env.schema';
import { Ingredient } from './entities/Ingredient';
import { IngredientCategory } from './entities/IngredientCategory';
import { IngredientProduct } from './entities/IngredientProduct';
import { IngredientUnitConversion } from './entities/IngredientUnitConversion';
import { ProductPrice } from './entities/ProductPrice';
import { Retailer } from './entities/Retailer';
import { StoreLocation } from './entities/StoreLocation';
import { Unit } from './entities/Unit';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [
    Ingredient,
    IngredientCategory,
    IngredientProduct,
    IngredientUnitConversion,
    ProductPrice,
    Retailer,
    StoreLocation,
    Unit,
  ],
  synchronize: false,
});
