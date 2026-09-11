import { AppDataSource } from '../data-source';
import { Ingredient } from '../entities/Ingredient';

export const ingredientRepository = AppDataSource.getRepository(Ingredient);
