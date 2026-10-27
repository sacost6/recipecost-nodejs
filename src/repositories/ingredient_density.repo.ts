import { AppDataSource } from '../data-source';
import { IngredientDensity } from '../entities/IngredientDensity';

export const ingredientDensityRepository =
  AppDataSource.getRepository(IngredientDensity);
