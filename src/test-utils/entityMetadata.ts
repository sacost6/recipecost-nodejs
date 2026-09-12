import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Ingredient } from '../entities/Ingredient';
import { IngredientCategory } from '../entities/IngredientCategory';
import { IngredientProduct } from '../entities/IngredientProduct';
import { IngredientUnitConversion } from '../entities/IngredientUnitConversion';
import { Unit } from '../entities/Unit';
import { User } from '../entities/User';
import { ProductPrice } from '../entities/ProductPrice';
import { StoreLocation } from '../entities/StoreLocation';
import { Retailer } from '../entities/Retailer';

/** Builds real PostgreSQL column metadata without opening a connection. */
export class MetadataDataSource extends DataSource {
  prepareMetadata() {
    return this.buildMetadatas();
  }
}

export const metadataSource = () =>
  new MetadataDataSource({
    type: 'postgres',
    entities: [
      Ingredient,
      IngredientCategory,
      IngredientProduct,
      IngredientUnitConversion,
      Unit,
      User,
      ProductPrice,
      StoreLocation,
      Retailer,
    ],
  });
