import { AppDataSource } from '../data-source';
import { IngredientUnitConversion } from '../entities/IngredientUnitConversion';

export const ingredientUnitConversionRepository = AppDataSource.getRepository(
  IngredientUnitConversion,
);