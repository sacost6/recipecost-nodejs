import { AppDataSource } from '../data-source';
import { IngredientCategory } from '../entities/IngredientCategory';

export const ingredientCategoryRepository =
  AppDataSource.getRepository(IngredientCategory);
