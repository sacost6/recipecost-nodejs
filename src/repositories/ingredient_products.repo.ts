import { AppDataSource } from '../data-source';
import { IngredientProduct } from '../entities/IngredientProduct';

export const ingredientProductRepository =
  AppDataSource.getRepository(IngredientProduct);